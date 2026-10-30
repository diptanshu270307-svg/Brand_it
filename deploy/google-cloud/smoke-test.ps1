#Requires -Version 7.0
<#
.SYNOPSIS
Checks an already deployed BrandLint origin without changing workspace data.
.EXAMPLE
./deploy/google-cloud/smoke-test.ps1 -BaseUrl https://brandlint.example.com
.EXAMPLE
./deploy/google-cloud/smoke-test.ps1 -BaseUrl https://brandlint.example.com -CheckLogin
.DESCRIPTION
Public checks use GET only. Optional login checks create and revoke their own session,
verify cookie authentication, and confirm CSRF protection. No API key, cloud CLI,
registration, invitations, AI calls, or workspace mutations are used. Credentials
and response tokens are held in memory and are never printed or written to files.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][Uri]$BaseUrl,
    [ValidateSet('production', 'development', 'isolated-demo', 'any')]
    [string]$ExpectedMode = 'production',
    [switch]$CheckLogin,
    [PSCredential]$Credential,
    [ValidateRange(5, 120)][int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $BaseUrl.IsAbsoluteUri -or $BaseUrl.UserInfo -or $BaseUrl.Query -or $BaseUrl.Fragment -or $BaseUrl.AbsolutePath -ne '/') {
    throw 'BaseUrl must be an origin only, for example https://brandlint.example.com (no credentials, path, query or fragment).'
}
if ($BaseUrl.Scheme -ne 'https' -and -not ($BaseUrl.Scheme -eq 'http' -and $BaseUrl.Host -in @('localhost', '127.0.0.1', '[::1]'))) {
    throw 'Use HTTPS for deployed origins. HTTP is permitted only for local checks.'
}

$script:origin = $BaseUrl.GetLeftPart([UriPartial]::Authority)
$script:webSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$script:passed = 0

function Invoke-Probe {
    param(
        [Parameter(Mandatory)][string]$Path,
        [int]$ExpectedStatus = 200,
        [ValidateSet('json', 'html', 'asset')][string]$Kind = 'json',
        [ValidateSet('GET', 'POST')][string]$Method = 'GET',
        [string]$JsonBody,
        [hashtable]$Headers = @{}
    )
    $arguments = @{
        Uri = "$script:origin$Path"; Method = $Method; WebSession = $script:webSession;
        Headers = $Headers; TimeoutSec = $TimeoutSeconds; MaximumRedirection = 0;
        SkipHttpErrorCheck = $true
    }
    if ($JsonBody) { $arguments.Body = $JsonBody; $arguments.ContentType = 'application/json' }
    try { $response = Invoke-WebRequest @arguments }
    catch { throw "Request failed: $Method $Path. Check DNS, TLS, service availability and the configured origin." }
    if ([int]$response.StatusCode -ne $ExpectedStatus) {
        throw "$Method $Path returned HTTP $($response.StatusCode); expected $ExpectedStatus. Response bodies are omitted to protect credentials."
    }
    $contentType = [string]($response.Headers['Content-Type'] -join ',')
    if ($Path.StartsWith('/api/')) {
        if ([string]($response.Headers['Cache-Control'] -join ',') -notmatch '(?i)no-store') {
            throw "$Method $Path is missing its no-store cache policy."
        }
        if ([string]($response.Headers['Vary'] -join ',') -notmatch '(?i)(?:^|,)\s*Cookie\s*(?:,|$)') {
            throw "$Method $Path is missing Vary: Cookie."
        }
    }
    if ($Kind -eq 'json' -and $contentType -notmatch '(?i)application/(?:[a-z0-9.+-]*\+)?json') {
        throw "$Method $Path did not return JSON. Check that the SPA fallback does not swallow API routes."
    }
    if ($Kind -eq 'html' -and ($contentType -notmatch '(?i)text/html' -or -not ([string]$response.Content).Contains('id="root"'))) {
        throw "$Method $Path did not return the built React application."
    }
    if ($Kind -eq 'asset' -and $contentType -match '(?i)text/html') {
        throw "$Method $Path returned HTML instead of a JavaScript asset."
    }
    $script:passed++
    Write-Host "PASS $Method $Path ($ExpectedStatus)"
    if ($Kind -eq 'json') { return ($response.Content | ConvertFrom-Json) }
    return $response
}

Write-Host "Checking $script:origin"
$health = Invoke-Probe -Path '/api/health'
if ($health.status -ne 'ok') { throw 'API health is not ok.' }
$liveness = Invoke-Probe -Path '/healthz'
if ($liveness.status -ne 'live') { throw 'Liveness is not live.' }
$readiness = Invoke-Probe -Path '/readyz'
if ($readiness.status -ne 'ready') { throw 'Readiness is not ready; inspect database, migrations and storage configuration.' }
$mode = Invoke-Probe -Path '/api/system/mode'
if ($ExpectedMode -ne 'any' -and $mode.mode -ne $ExpectedMode) { throw "Expected mode $ExpectedMode; received $($mode.mode)." }
if ($mode.is_production -and ($mode.allow_reset -or $mode.allow_persona_switch)) { throw 'Production must disable demo resets and persona switching.' }

$home = Invoke-Probe -Path '/' -Kind html
$null = Invoke-Probe -Path '/review' -Kind html
$null = Invoke-Probe -Path '/api/__brandlint_missing_smoke_route__' -ExpectedStatus 404
$null = Invoke-Probe -Path '/assets/__brandlint_missing_smoke_asset__.js' -ExpectedStatus 404
$null = Invoke-Probe -Path '/api/me' -ExpectedStatus 401

# Fetch the real bundled script, ignoring loader dependencies hosted on external CDNs.
$bundle = [regex]::Match([string]$home.Content, 'src="(?<path>/assets/[^"?]+\.js)"')
if (-not $bundle.Success) { throw 'The HTML contains no same-origin built JavaScript entry under /assets/.' }
$null = Invoke-Probe -Path $bundle.Groups['path'].Value -Kind asset

if ($CheckLogin) {
    if (-not $Credential) { $Credential = Get-Credential -Message 'Use an existing BrandLint account. This check creates and logs out only its own session.' }
    if (-not $Credential) { throw 'Login checks require an existing account credential.' }
    $csrf = ''
    $authenticated = $false
    try {
        $passwordText = $Credential.GetNetworkCredential().Password
        $body = @{ email = $Credential.UserName; password = $passwordText } | ConvertTo-Json -Compress
        $login = Invoke-Probe -Path '/api/auth/login' -Method POST -JsonBody $body -Headers @{ Origin = $script:origin }
        $passwordText = $null; $body = $null
        $csrf = [string]$login.csrf_token
        if (-not $csrf) { throw 'Login returned no CSRF token.' }
        $authenticated = $true
        $session = Invoke-Probe -Path '/api/auth/session'
        if (-not $session.authenticated -or -not $session.csrf_token) { throw 'Cookie session could not be restored.' }
        $csrf = [string]$session.csrf_token
        $me = Invoke-Probe -Path '/api/me'
        if (-not $me.user.id) { throw 'Authenticated profile returned no user.' }
        if (@($me.companies).Count -eq 0 -and @($me.brands).Count -eq 0) {
            Write-Warning 'Login works, but this account has no workspace. Use Create workspace in the app.'
        }
        # Deliberately send cookies without Bearer credentials: missing CSRF must be rejected.
        $null = Invoke-Probe -Path '/api/auth/logout' -Method POST -JsonBody '{}' -ExpectedStatus 403 -Headers @{ Origin = $script:origin }
        $null = Invoke-Probe -Path '/api/auth/logout' -Method POST -JsonBody '{}' -Headers @{ Origin = $script:origin; 'X-CSRF-Token' = $csrf }
        $authenticated = $false
        $null = Invoke-Probe -Path '/api/me' -ExpectedStatus 401
    } finally {
        if ($authenticated -and $csrf) {
            try { $null = Invoke-Probe -Path '/api/auth/logout' -Method POST -JsonBody '{}' -Headers @{ Origin = $script:origin; 'X-CSRF-Token' = $csrf } }
            catch { Write-Warning 'The temporary smoke-test session could not be logged out. It will expire under normal session policy.' }
        }
        $passwordText = $null; $body = $null; $login = $null; $csrf = $null; $Credential = $null
    }
}
Write-Host "Completed: $script:passed HTTP checks passed. No workspace data was created or changed."
