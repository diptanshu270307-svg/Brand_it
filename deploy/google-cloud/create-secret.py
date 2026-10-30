#!/usr/bin/env python3
"""Create a Secret Manager value over stdin, without echoing it or writing a local file."""
import argparse
import getpass
import re
import secrets
import shutil
import subprocess
from urllib.parse import quote


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--generate", action="store_true", help="Generate a random signing key.")
    parser.add_argument("--connection", help="Cloud SQL project:region:instance connection name.")
    parser.add_argument("--database", default="brandlint")
    parser.add_argument("--database-user")
    parser.add_argument("--add-version", action="store_true", help="Add a version to an existing secret.")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z][a-z0-9-]{4,28}[a-z0-9]", args.project):
        parser.error("Supply a real Google Cloud project ID.")
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.name):
        parser.error("Invalid Secret Manager name.")
    if args.generate and (args.connection or args.database_user):
        parser.error("Choose generated signing key OR database credentials.")
    if bool(args.connection) != bool(args.database_user):
        parser.error("Database secrets require both --connection and --database-user.")
    command = shutil.which("gcloud")
    if not command:
        parser.error("Install and authenticate the Google Cloud CLI first.")
    if args.generate:
        value = secrets.token_urlsafe(64)
    elif args.connection:
        if not re.fullmatch(r"[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+", args.connection):
            parser.error("Cloud SQL connection must be project:region:instance.")
        password = getpass.getpass(f"Database password for {args.database_user}: ")
        if not password:
            parser.error("A database password is required.")
        value = (f"postgresql+psycopg://{quote(args.database_user, safe='')}:{quote(password, safe='')}"
                 f"@/{quote(args.database, safe='')}?host={quote('/cloudsql/' + args.connection, safe='')}")
    else:
        value = getpass.getpass("Secret value (hidden): ")
        if not value:
            parser.error("Secret must not be empty.")
    flags = ["secrets", "versions", "add", args.name] if args.add_version else ["secrets", "create", args.name, "--replication-policy=automatic"]
    subprocess.run([command, *flags, "--project", args.project, "--data-file=-"], input=value.encode("utf-8"), check=True)
    print("Secret Manager updated. Pin the returned version in the deployment command; the value was not printed.")


if __name__ == "__main__":
    main()
