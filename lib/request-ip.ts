// IP du client. Sur Vercel, x-forwarded-for est réécrit par la plateforme :
// le premier élément est l'IP réelle et ne peut pas être imposé par le client.
export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
