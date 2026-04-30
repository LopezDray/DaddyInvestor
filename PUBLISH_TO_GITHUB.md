# Publish To GitHub

Repo เป้าหมาย: `LopezDray/DaddyInvestor`

เครื่องนี้ยัง push ตรงไม่ได้ เพราะ `git` ออก GitHub ไม่ได้, ไม่มี GitHub CLI และ `.git` local ถูกล็อก write access

## วิธีอัปโหลดด้วย GitHub หน้าเว็บ

1. เปิด `https://github.com/LopezDray/DaddyInvestor`
2. กด `Add file` > `Upload files`
3. เปิดโฟลเดอร์ `github-upload/DaddyInvestor`
4. ลากไฟล์และโฟลเดอร์ทั้งหมดในนั้นขึ้น GitHub
5. Commit เข้า branch `main`
6. เปิด GitHub Pages URL: `https://lopezdray.github.io/DaddyInvestor/`

## หลังอัปโหลด

1. ไปที่ `Settings` > `Secrets and variables` > `Actions`
2. เพิ่ม secret ชื่อ `FMP_API_KEY`
3. ไปที่ `Actions`
4. Run workflow `Update asset DB`

Workflow จะสร้าง local DB สำหรับ S&P 500 + Russell 2000 แล้ว commit กลับเข้า repo
