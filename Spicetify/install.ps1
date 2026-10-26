$source = "$PSScriptRoot\spicetify\passiveAlbumMode.js"
$destination = "$env:APPDATA\spicetify\Extensions\passiveAlbumMode.js"

Copy-Item $source $destination -Force

spicetify config extensions passiveAlbumMode.js
spicetify apply

Write-Host "Passive Mode geïnstalleerd."