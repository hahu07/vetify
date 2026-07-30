import { withRoute } from "@/lib/apiHelpers";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/domain/murabahah";
import { serializePurchaseOrder } from "@/lib/serialize";

export const GET = withRoute(async (session) => {
  const rows = await listPurchaseOrders(session);
  return rows.map(serializePurchaseOrder);
});

export const POST = withRoute(async (session, req) => {
  const body = await req.json();
  return createPurchaseOrder(session, {
    cacRegNumber: body.cacRegNumber,
    businessName: body.businessName,
    facilityRef: body.facilityRef,
    supplierName: body.supplierName,
    supplierDetails: body.supplierDetails,
    orderedItems: body.orderedItems,
    totalOrderValue: body.totalOrderValue,
    deliveryDeadline: body.deliveryDeadline,
    poRef: body.poRef,
  });
});
