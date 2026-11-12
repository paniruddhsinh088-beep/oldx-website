"""Inspect the config, history and every layer in a single-image docker save."""

import json
import re
import sys
import tarfile
from pathlib import PurePosixPath


SENSITIVE_NAME = re.compile(
    r"^(?:\.env(?:\..+)?|\.npmrc|\.netrc|\.git-credentials|\.firebaserc|"
    r"application_default_credentials\.json|credentials\.json|"
    r"service[-_]?account[^/]*\.json|firebase-env\.js|google-services\.json|"
    r"id_(?:rsa|ed25519|ecdsa|dsa))$", re.I
)
SECRET = re.compile(
    rb"-----BEGIN (?:[A-Z0-9]{1,24} ){0,4}PRIVATE KEY-----(?:[\r\n]|\\{1,3}[rn]){1,4}[A-Za-z0-9+/]{16,}|"
    rb'(?:\\?"private_key\\?"\s*:\s*\\?")[^"\\]{16,256}|'
    rb'(?:\\?"type\\?"\s*:\s*\\?"service_account\\?")|'
    rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{50,255}|"
    rb"(?:AKIA|ASIA)[A-Z0-9]{16}|npm_[A-Za-z0-9]{30,100})\b|"
    rb"(?:_authToken|_auth)\s*=\s*[A-Za-z0-9+/=_-]{12,256}",
    re.I,
)
NPMRC = "usr/local/lib/node_modules/npm/.npmrc"


def contains_marker(stream):
    tail = b""
    while chunk := stream.read(65536):
        window = tail + chunk
        if SECRET.search(window):
            return True
        tail = window[-1024:]
    return False


def audit(image_stream, base_npmrc, expected_layers):
    with tarfile.open(fileobj=image_stream, mode="r:") as archive:
        manifest, = json.load(archive.extractfile("manifest.json"))
        with archive.extractfile(manifest["Config"]) as config_stream:
            if contains_marker(config_stream):
                raise ValueError("Credential marker in image config or history")
        layers = manifest["Layers"]
        if not layers or len(layers) != expected_layers or len(set(layers)) != len(layers):
            raise ValueError("Saved layer count does not match the inspected image")
        for index, layer_name in enumerate(layers, 1):
            with archive.extractfile(layer_name) as blob, tarfile.open(fileobj=blob, mode="r|*") as layer:
                for entry in layer:
                    path = PurePosixPath(entry.name)
                    if path.as_posix() == NPMRC and entry.isfile():
                        if layer.extractfile(entry).read(len(base_npmrc) + 1) != base_npmrc:
                            raise ValueError(f"Modified built-in npm config in layer {index}")
                        continue
                    if SENSITIVE_NAME.fullmatch(path.name):
                        raise ValueError(f"Sensitive filename in layer {index}")
                    if entry.isfile() and contains_marker(layer.extractfile(entry)):
                        raise ValueError(f"Credential marker in layer {index}")
                    if (entry.issym() or entry.islnk()) and SENSITIVE_NAME.fullmatch(PurePosixPath(entry.linkname).name):
                        raise ValueError(f"Sensitive link target in layer {index}")
        return len(layers)


if __name__ == "__main__":
    try:
        with open(sys.argv[1], "rb") as image, open(sys.argv[2], "rb") as npmrc:
            count = audit(image, npmrc.read(), int(sys.argv[3]))
    except ValueError as error:
        # Report only messages authored above. Parser errors may include input.
        message = str(error)
        if not re.fullmatch(r"(?:Credential marker in image config or history|Saved layer count does not match the inspected image|(?:Modified built-in npm config|Sensitive filename|Credential marker|Sensitive link target) in layer \d+)", message):
            message = "Invalid saved image metadata"
        sys.exit(message)
    except (OSError, KeyError, TypeError, tarfile.TarError):
        sys.exit("Saved image could not be inspected")
    print(f"Credential markers and sensitive filenames checked across {count} image layers and image config/history")
