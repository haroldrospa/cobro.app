param(
  [Parameter(Mandatory = $true)][string]$File,
  [string]$Printer = "4BARCODE 4B-2074B"
)
# Envía comandos crudos (TSPL) a la impresora a través del spooler de Windows (RAW)
$code = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string name, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
  public static bool Send(string printer, byte[] data) {
    IntPtr h; if (!OpenPrinter(printer, out h, IntPtr.Zero)) return false;
    DOCINFO di = new DOCINFO(); di.pDocName = "TSPL RAW"; di.pDataType = "RAW";
    bool ok = false;
    if (StartDocPrinter(h, 1, di) > 0) {
      if (StartPagePrinter(h)) { int w; ok = WritePrinter(h, data, data.Length, out w); EndPagePrinter(h); }
      EndDocPrinter(h);
    }
    ClosePrinter(h); return ok;
  }
}
"@
if (-not ("RawPrinter" -as [type])) { Add-Type -TypeDefinition $code }
$text = (Get-Content -Raw -Path $File) -replace "`r?`n", "`r`n"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($text)
$ok = [RawPrinter]::Send($Printer, $bytes)
Write-Output "Enviado: $ok ($($bytes.Length) bytes) -> $Printer"
