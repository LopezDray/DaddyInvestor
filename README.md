# Local Asset DB Sources

วางไฟล์จาก FMP หรือแหล่งข้อมูลที่ export มาไว้ในโฟลเดอร์นี้ แล้วรันตัวสร้างฐานข้อมูลแบบ offline ได้ทันที

## ไฟล์ holdings

ใส่อย่างใดอย่างหนึ่งต่อ index:

- S&P 500: `ivv-holdings.json`, `ivv-holdings.csv`, `sp500-holdings.json`, หรือ `sp500-holdings.csv`
- Russell 2000: `iwm-holdings.json`, `iwm-holdings.csv`, `russell2000-holdings.json`, หรือ `russell2000-holdings.csv`

คอลัมน์หรือ field ที่ระบบอ่าน ticker ได้:

- `symbol`
- `asset`
- `holdingSymbol`
- `ticker`

## ไฟล์ profile

ใส่อย่างใดอย่างหนึ่ง:

- `profiles.json` หรือ `profiles.csv`
- `profile-bulk.json` หรือ `profile-bulk.csv`
- `profile-bulk-0.json`, `profile-bulk-1.json`, ... หรือ `.csv`

คอลัมน์หรือ field ที่แนะนำ:

- `symbol`
- `companyName` หรือ `name`
- `sector`
- `industry`
- `exchangeShortName` หรือ `exchange`
- `isEtf`
- `beta`
- `mktCap` หรือ `marketCap`

## Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-us-assets-lite.ps1 -Offline -SourceDir .\source_data\asset_db
```

ผลลัพธ์จะเขียนทับ `assets/us-assets-lite.js` และสร้างรายงาน `assets/index-coverage-report.json`
