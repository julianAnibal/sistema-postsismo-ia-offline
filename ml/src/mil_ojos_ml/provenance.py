from __future__ import annotations

import hashlib
import json
import shutil
import stat
import tempfile
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath


def read_provenance(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("El manifiesto de procedencia debe ser un objeto JSON")
    return value


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_artifact(path: Path, *, expected_size: int, expected_sha256: str) -> None:
    if not path.is_file():
        raise FileNotFoundError(path)
    actual_size = path.stat().st_size
    if actual_size != expected_size:
        raise ValueError(
            f"Tamano inesperado para {path}: {actual_size}; esperado {expected_size}"
        )
    actual_sha256 = sha256(path)
    if actual_sha256 != expected_sha256.lower():
        raise ValueError(
            f"SHA-256 inesperado para {path}: {actual_sha256}; "
            f"esperado {expected_sha256.lower()}"
        )


def download_verified(
    url: str,
    destination: Path,
    *,
    expected_size: int,
    expected_sha256: str,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        verify_artifact(
            destination,
            expected_size=expected_size,
            expected_sha256=expected_sha256,
        )
        return

    with tempfile.NamedTemporaryFile(
        prefix=f".{destination.name}.",
        suffix=".partial",
        dir=destination.parent,
        delete=False,
    ) as temporary:
        temporary_path = Path(temporary.name)
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": "sistema-postsismo-data-fetch/1.0"},
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                shutil.copyfileobj(response, temporary, length=1024 * 1024)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise

    try:
        verify_artifact(
            temporary_path,
            expected_size=expected_size,
            expected_sha256=expected_sha256,
        )
        temporary_path.replace(destination)
    except Exception:
        temporary_path.unlink(missing_ok=True)
        raise


def _safe_member_path(member: zipfile.ZipInfo) -> PurePosixPath:
    path = PurePosixPath(member.filename)
    file_type = (member.external_attr >> 16) & 0o170000
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"Ruta insegura dentro del ZIP: {member.filename!r}")
    if file_type == stat.S_IFLNK:
        raise ValueError(f"Enlace simbolico no permitido dentro del ZIP: {member.filename!r}")
    return path


def extract_zip_atomic(
    archive: Path,
    output: Path,
    *,
    maximum_uncompressed_bytes: int,
) -> None:
    if output.exists():
        raise FileExistsError(f"El directorio de salida ya existe: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(archive) as package:
        members = package.infolist()
        total = sum(member.file_size for member in members if not member.is_dir())
        if total > maximum_uncompressed_bytes:
            raise ValueError(
                f"ZIP excede el limite descomprimido: {total} > {maximum_uncompressed_bytes}"
            )
        for member in members:
            _safe_member_path(member)

        staging = Path(
            tempfile.mkdtemp(prefix=f".{output.name}.staging-", dir=output.parent)
        )
        try:
            for member in members:
                relative = _safe_member_path(member)
                destination = staging.joinpath(*relative.parts)
                if member.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                with package.open(member) as source, destination.open("wb") as target:
                    shutil.copyfileobj(source, target, length=1024 * 1024)
            staging.replace(output)
        except Exception:
            shutil.rmtree(staging, ignore_errors=True)
            raise
