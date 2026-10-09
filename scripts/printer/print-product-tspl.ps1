param(
  [string]$Printer = "4BARCODE 4B-2074B",
  [string]$Name = "ERAS TODOTERREN 12OZ",
  [string]$Price = "75.00",
  [string]$Barcode = "012354000995",
  [int]$Copies = 1
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# TSPL 203 DPI coordinates for 30x20mm:
# Width = 240 dots (30mm), Height = 160 dots (20mm)
# Name: font 1 (8x12 dots), centered horizontally
$nameClean = $Name.Substring(0, [Math]::Min($Name.Length, 24))
$nameDots = $nameClean.Length * 8
$nameX = [Math]::Max(6, [Math]::Round((240 - $nameDots) / 2))

# Price: font 2 (12x20 dots), centered horizontally
$priceText = "`$$Price"
$priceDots = $priceText.Length * 12
$priceX = [Math]::Max(6, [Math]::Round((240 - $priceDots) / 2))

# Barcode: code 128, height 40 dots, width 2
# Approx barcode width: (10 + characters * 11) * 2 dots = ~300 dots if too long, so width 1 for > 10 chars
$barNarrow = if ($Barcode.Length -gt 10) { 1 } else { 2 }
# Approx width in dots
$barEstWidth = (35 + ($Barcode.Length * 11)) * $barNarrow
$barX = [Math]::Max(8, [Math]::Round((240 - $barEstWidth) / 2))

$tspl = @"
SIZE 30 mm,20 mm
GAP 2 mm,0 mm
DIRECTION 1
REFERENCE 0,0
OFFSET 0 mm
SHIFT 0
SET TEAR ON
DENSITY 8
SPEED 3
CLS
TEXT $nameX,16,"1",0,1,1,"$nameClean"
TEXT $priceX,34,"2",0,1,1,"$priceText"
BARCODE $barX,60,"128",40,1,0,$barNarrow,$barNarrow,"$Barcode"
PRINT 1,$Copies
"@

$tmp = [System.IO.Path]::GetTempFileName()
$tspl | Out-File -FilePath $tmp -Encoding ascii
powershell -ExecutionPolicy Bypass -File "$scriptDir\send-raw.ps1" -File $tmp -Printer $Printer
Remove-Item $tmp -Force
