@echo off
echo === RUN AGENT START (%date% %time%) ===
cd /d C:\Users\knight\Desktop\tavoleefavole\tavoleefavole-next

node scripts\inv-sync-agent.mjs

echo === RUN AGENT END (%date% %time%) ===
pause




