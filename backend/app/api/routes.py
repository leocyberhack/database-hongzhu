from fastapi import APIRouter

from app.api.endpoints import health
from app.api.endpoints import auth
from app.api.endpoints import resources
from app.api.endpoints import suppliers
from app.api.endpoints import products
from app.api.endpoints import pricing
from app.api.endpoints import inventory
from app.api.endpoints import orders
from app.api.endpoints import approvals
from app.api.endpoints import audit
from app.api.endpoints import reports
from app.api.endpoints import sku_gate
from app.api.endpoints import product_resources
from app.api.endpoints import supplier_price_history
from app.api.endpoints import order_status
from app.api.endpoints import sku_channels
from app.api.endpoints import channels
from app.api.endpoints import skus
from app.api.endpoints import regions

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(resources.router, tags=["resource"])
api_router.include_router(suppliers.router, tags=["supplier"])
api_router.include_router(products.router, tags=["product"])
api_router.include_router(pricing.router, tags=["pricing"])
api_router.include_router(inventory.router, tags=["inventory"])
api_router.include_router(orders.router, tags=["order"])
api_router.include_router(approvals.router, tags=["approval"])
api_router.include_router(audit.router, tags=["audit"])
api_router.include_router(reports.router, tags=["report"])
api_router.include_router(sku_gate.router, tags=["sku-gate"])
api_router.include_router(product_resources.router, tags=["product-resource"])
api_router.include_router(supplier_price_history.router, tags=["supplier-resource-price-history"])
api_router.include_router(order_status.router, tags=["order-status-history"])
api_router.include_router(sku_channels.router, prefix="/sku_channels", tags=["sku-channel"])
api_router.include_router(channels.router, prefix="/channels", tags=["channel"])
api_router.include_router(skus.router, prefix="/skus", tags=["sku"])
api_router.include_router(regions.router, tags=["region"])

# File upload router
from app.api.endpoints import files
api_router.include_router(files.router, prefix="/files", tags=["files"])
