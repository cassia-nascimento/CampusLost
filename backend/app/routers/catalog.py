from fastapi import APIRouter

from .. import catalog

router = APIRouter(tags=["catalog"])


@router.get("/catalog")
def get_catalog():
    """Categorias e locais (DADOS DEMONSTRATIVOS, P5). Público."""
    return {"categories": list(catalog.CATEGORIES), "locations": list(catalog.LOCATIONS), "notice": catalog.NOTICE}
