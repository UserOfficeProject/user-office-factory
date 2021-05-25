#Adds all chrome default fonts. Can omit all but ariblk.ttf if needed 
& "C:\App\Add-Font.ps1" -path "C:\fonts\arial.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\arialbd.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\arialbi.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\ariali.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\ARIALN.TTF"
& "C:\App\Add-Font.ps1" -path "C:\fonts\ARIALNB.TTF"
& "C:\App\Add-Font.ps1" -path "C:\fonts\ARIALNBI.TTF"
& "C:\App\Add-Font.ps1" -path "C:\fonts\ARIALNI.TTF"
& "C:\App\Add-Font.ps1" -path "C:\fonts\ariblk.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\consola.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\consolab.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\consolaz.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\times.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\timesbd.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\timesbi.ttf"
& "C:\App\Add-Font.ps1" -path "C:\fonts\timesi.ttf"

#Checks if package exists so it can be used just to add font and start factory for Dockerfile.win and Dockerfile.dev.win
if ($env:DOCKER_START_DEV -eq 1) 
{
    npm run dev:docker
}
else 
{
    node /app/build/index.js
}
