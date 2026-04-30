window.DADDY_API_CONFIG = {
  // เว็บจะค้นจาก local DB ก่อนเสมอ เพื่อให้เร็วและประหยัด API
  // ใส่ Cloudflare Worker URL เฉพาะตอนต้องการ fallback สำหรับ ticker ที่ local DB ยังไม่เจอ
  // ตัวอย่าง: "https://daddy-asset-api.your-subdomain.workers.dev/asset"
  // ระหว่าง demo ถ้าต้องการลอง fallback จำลอง ให้เปลี่ยนเป็น "sample"
  assetEndpoint: "",
};
