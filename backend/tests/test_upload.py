"""Upload de fotos: tipo pelo CONTEÚDO, limite de 10 MB, nome gerado, servidas em /uploads."""

from __future__ import annotations

import re

import pytest

from tests.conftest import ITEM_FORM, JPEG, PNG, WEBP

UUID_FILE = re.compile(r"^/uploads/[0-9a-f]{32}\.(jpg|png|webp)$")


def files(name="foto.jpg", data=JPEG, ctype="image/jpeg"):
    return {"photo": (name, data, ctype)}


@pytest.mark.parametrize("data, ext, ctype", [(JPEG, "jpg", "image/jpeg"), (PNG, "png", "image/png"), (WEBP, "webp", "image/webp")])
def test_valid_images_are_stored_and_served(client, student, settings, data, ext, ctype):
    r = client.post("/items", data=ITEM_FORM, files=files(f"x.{ext}", data, ctype), headers=student)
    assert r.status_code == 201
    url = r.json()["photoUrl"]
    assert UUID_FILE.match(url) and url.endswith("." + ext)
    assert (settings.uploads_dir / url.split("/")[-1]).read_bytes() == data
    served = client.get(url)
    assert served.status_code == 200 and served.content == data
    assert served.headers["x-content-type-options"] == "nosniff"
    # aparece na lista e no detalhe com o mesmo valor
    assert client.get(f"/items/{r.json()['id']}").json()["item"]["photoUrl"] == url


def test_server_picks_the_extension_from_content_not_from_filename(client, student):
    r = client.post("/items", data=ITEM_FORM, files=files("foto.png", JPEG, "image/png"), headers=student)
    assert r.status_code == 201 and r.json()["photoUrl"].endswith(".jpg")


def test_original_filename_never_used(client, student, settings):
    r = client.post("/items", data=ITEM_FORM, files=files("../../etc/passwd.jpg"), headers=student)
    assert r.status_code == 201
    url = r.json()["photoUrl"]
    assert UUID_FILE.match(url)
    assert not (settings.uploads_dir.parent / "etc").exists()


@pytest.mark.parametrize(
    "name, data, ctype",
    [
        ("falso.jpg", b"isto nao e uma imagem, e texto puro", "image/jpeg"),
        ("script.jpg", b"<?php echo 1; ?>", "image/jpeg"),
        ("pagina.png", b"<html><script>alert(1)</script></html>", "image/png"),
        ("vetor.jpg", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "image/jpeg"),
        ("anim.gif", b"GIF89a" + b"\x00" * 40, "image/gif"),
        ("doc.pdf", b"%PDF-1.4\n" + b"\x00" * 40, "application/pdf"),
        ("riff.webp", b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 40, "image/webp"),
        ("curto.jpg", b"\xff\xd8", "image/jpeg"),
    ],
)
def test_fake_or_unsupported_files_are_rejected(client, student, settings, name, data, ctype):
    r = client.post("/items", data=ITEM_FORM, files=files(name, data, ctype), headers=student)
    assert r.status_code == 422
    assert r.json() == {"code": "PHOTO_INVALID", "message": "Formato não aceito. Use JPG, PNG ou WebP."}
    assert [p for p in settings.uploads_dir.iterdir() if p.is_file()] == []
    assert client.get("/items").json()[0]["id"] == "item-01"  # nenhum item criado


def test_empty_file_with_name_is_rejected(client, student):
    r = client.post("/items", data=ITEM_FORM, files=files("vazio.jpg", b"", "image/jpeg"), headers=student)
    assert r.status_code == 422 and r.json() == {"code": "PHOTO_INVALID", "message": "O arquivo está vazio."}


def test_size_limit_is_10_mb(client, student):
    ok = JPEG + b"\x00" * (10 * 1024 * 1024 - len(JPEG))
    assert len(ok) == 10 * 1024 * 1024
    assert client.post("/items", data=ITEM_FORM, files=files("ok.jpg", ok), headers=student).status_code == 201
    too_big = ok + b"\x00"
    r = client.post("/items", data=ITEM_FORM, files=files("grande.jpg", too_big), headers=student)
    assert r.status_code == 422
    assert r.json() == {"code": "PHOTO_INVALID", "message": "A foto passa de 10 MB. Escolha uma menor."}


def test_body_over_limit_is_413(client, student):
    huge = JPEG + b"\x00" * (12 * 1024 * 1024)
    r = client.post("/items", data=ITEM_FORM, files=files("enorme.jpg", huge), headers=student)
    assert r.status_code == 413
    assert r.json()["code"] == "PHOTO_INVALID"
    r = client.post("/auth/login", content=b"x" * (12 * 1024 * 1024), headers={"Content-Type": "application/json"})
    assert r.status_code == 413 and r.json()["code"] == "VALIDATION"


def test_empty_photo_part_from_browser_means_no_photo(client, student):
    r = client.post("/items", data=ITEM_FORM, files={"photo": ("", b"", "application/octet-stream")}, headers=student)
    assert r.status_code == 201 and r.json()["photoUrl"] is None


def test_photo_field_as_plain_text_is_rejected(client, student):
    r = client.post("/items", data={**ITEM_FORM, "photo": "data:image/png;base64,AAAA"}, headers=student)
    assert r.status_code == 422 and r.json()["code"] == "PHOTO_INVALID"


def test_invalid_form_does_not_leave_orphan_file(client, student, settings):
    r = client.post("/items", data={**ITEM_FORM, "title": "x"}, files=files(), headers=student)
    assert r.status_code == 422 and r.json()["code"] == "VALIDATION"
    assert not [p for p in settings.uploads_dir.iterdir() if p.is_file()]


def test_guest_upload_is_401_and_nothing_saved(client, settings):
    r = client.post("/items", data=ITEM_FORM, files=files())
    assert r.status_code == 401
    assert not [p for p in settings.uploads_dir.iterdir() if p.is_file()]


def test_update_replaces_and_removes_photo_files(client, admin, student, settings):
    created = client.post("/items", data=ITEM_FORM, files=files(), headers=student).json()
    old = created["photoUrl"]
    old_path = settings.uploads_dir / old.split("/")[-1]
    assert old_path.exists()
    # sem foto no envio: mantém
    kept = client.put(f"/items/{created['id']}", data=ITEM_FORM, headers=admin).json()
    assert kept["photoUrl"] == old and old_path.exists()
    # foto nova: troca e apaga a antiga
    new = client.put(f"/items/{created['id']}", data=ITEM_FORM, files=files("n.png", PNG, "image/png"), headers=admin).json()
    assert new["photoUrl"] != old and new["photoUrl"].endswith(".png")
    assert not old_path.exists() and (settings.uploads_dir / new["photoUrl"].split("/")[-1]).exists()
    # removePhoto: some
    new_path = settings.uploads_dir / new["photoUrl"].split("/")[-1]
    gone = client.put(f"/items/{created['id']}", data={**ITEM_FORM, "removePhoto": "true"}, headers=admin).json()
    assert gone["photoUrl"] is None and not new_path.exists()


def test_update_with_invalid_photo_keeps_old_photo(client, admin, student, settings):
    created = client.post("/items", data=ITEM_FORM, files=files(), headers=student).json()
    r = client.put(f"/items/{created['id']}", data=ITEM_FORM, files=files("f.jpg", b"texto", "image/jpeg"), headers=admin)
    assert r.status_code == 422 and r.json()["code"] == "PHOTO_INVALID"
    assert client.get(f"/items/{created['id']}", headers=admin).json()["item"]["photoUrl"] == created["photoUrl"]


def test_deleting_item_removes_uploaded_photo_but_never_seed_images(client, admin, student, settings):
    created = client.post("/items", data=ITEM_FORM, files=files(), headers=student).json()
    path = settings.uploads_dir / created["photoUrl"].split("/")[-1]
    assert path.exists()
    assert client.delete(f"/items/{created['id']}", headers=admin).status_code == 204
    assert not path.exists()
    seed_file = settings.uploads_dir / "seed" / "chaveiro.webp"
    assert seed_file.exists()
    assert client.delete("/items/item-03", headers=admin).status_code == 204
    assert seed_file.exists()


def test_uploads_path_traversal_is_blocked(client, settings):
    (settings.uploads_dir.parent / "segredo.txt").write_text("segredo")
    for path in ("/uploads/../segredo.txt", "/uploads/%2e%2e/segredo.txt", "/uploads/..%2fsegredo.txt"):
        r = client.get(path)
        assert r.status_code == 404 and "segredo" not in r.text.replace('"Recurso não encontrado."', "")


def test_seed_images_are_served(client):
    r = client.get("/uploads/seed/mochila.svg")
    assert r.status_code == 200 and b"<svg" in r.content
    r = client.get("/uploads/seed/bone.webp")
    assert r.status_code == 200 and r.headers["content-type"] == "image/webp" and r.content[:4] == b"RIFF"
    assert client.get("/uploads/seed/../seed/bone.webp").status_code in (200, 404)
    assert client.get("/uploads/seed/%2e%2e/segredo.txt").status_code == 404
    for item in client.get("/items").json():
        assert client.get(item["photoUrl"]).status_code == 200
