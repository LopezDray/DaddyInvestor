# Asset DB Workflow

เป้าหมาย: ให้เว็บใช้ local DB เป็นแกนหลัก ครอบคลุม S&P 500 + Russell 2000 ก่อน แล้วค่อยใช้ Worker/API เฉพาะ ticker ที่ไม่เจอหรือข้อมูลไม่มั่นใจ

## โครงสร้างที่ทำไว้

- `assets/us-assets-lite.js`: ฐานข้อมูล local ที่หน้าเว็บโหลดทันที
- `assets/index-coverage-report.json`: รายงาน coverage ของ `SP500` และ `RUSSELL2000`
- `assets/asset-review-queue.json`: หุ้นที่ระบบจัดกลุ่มด้วย confidence ต่ำ ควรตรวจต่อ
- `assets/asset-overrides.json`: ตัวแก้ manual สำหรับหุ้นที่ข้อมูลดิบทำให้จัดกลุ่มผิด
- `.github/workflows/update-asset-db.yml`: GitHub Actions สำหรับ rebuild local DB อัตโนมัติ
- `scripts/daddy-asset-worker.js`: Cloudflare Worker fallback สำหรับหุ้นที่ local DB ยังไม่เจอ

## ทางหลัก: GitHub Actions

เหมาะสุดสำหรับ GitHub Pages เพราะไม่ต้องให้ผู้ใช้หน้าเว็บยิง FMP ทุกครั้ง และไม่ต้องฝัง API key ในหน้าเว็บ

1. เข้า GitHub repo
2. ไปที่ `Settings` > `Secrets and variables` > `Actions`
3. เพิ่ม repository secret ชื่อ `FMP_API_KEY`
4. ไปที่แท็บ `Actions`
5. เลือก workflow `Update asset DB`
6. กด `Run workflow`

Workflow จะทำงานแบบนี้:

1. ดึง holdings ของ `IVV` เพื่อแทน S&P 500
2. ดึง holdings ของ `IWM` เพื่อแทน Russell 2000
3. ดึง FMP profile bulk เพื่อเอา sector, industry, beta, market cap
4. จัดหุ้นเข้าหมวด `Cash / T-Bill`, `Hedge & Defense`, `Growth`, `Diversified`
5. สร้าง `assets/us-assets-lite.js`
6. ตรวจ coverage อย่างน้อย 95%
7. commit ไฟล์ DB กลับเข้า repo ถ้ามีการเปลี่ยนแปลง

## ทาง local

ใช้เมื่อเครื่องที่รันสคริปต์ออกเน็ตได้:

```powershell
$env:FMP_API_KEY="YOUR_KEY"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-us-assets-lite.ps1 -BulkParts 100 -MinMarketCap 0
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-asset-db.ps1 -MinCoveragePct 95
```

เครื่องนี้ตอนทดสอบถูกบล็อก socket ออกเว็บ จึงเหมาะกับการให้ GitHub Actions หรือเครื่องที่ออกเน็ตได้เป็นตัว build DB แทน

## ทาง offline

ถ้ามีไฟล์ holdings/profile อยู่แล้ว ให้วางใน `source_data/asset_db` แล้วรัน:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-us-assets-lite.ps1 -Offline -SourceDir .\source_data\asset_db
```

รายละเอียดชื่อไฟล์อยู่ใน `source_data/asset_db/README.md`

## Worker fallback

ใช้เฉพาะ ticker ที่ local DB ยังไม่เจอ:

1. Deploy `scripts/daddy-asset-worker.js` ไป Cloudflare Worker
2. ตั้ง secret ชื่อ `FMP_API_KEY` ใน Worker
3. แก้ `assets/api-config.js`

```js
window.DADDY_API_CONFIG = {
  assetEndpoint: "https://YOUR_WORKER_URL/asset",
};
```

ถ้ายังไม่ deploy Worker ให้ปล่อย `assetEndpoint` เป็นค่าว่าง หน้าเว็บจะใช้ local DB อย่างเดียว

## หลักการประหยัด

1. Local DB ก่อน
2. Worker/API เฉพาะ ticker ที่ไม่เจอ
3. AI ตรวจเฉพาะรายการใน `asset-review-queue.json`
4. ตัวที่ตรวจแล้วแก้ใน `asset-overrides.json`
