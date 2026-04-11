param(
  [Parameter(Mandatory = $true)][string]$BinPath,
  [Parameter(Mandatory = $false)][string]$PrinterName = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BinPath)) {
  throw "Arquivo nao encontrado: $BinPath"
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
  $def = Get-CimInstance -ClassName Win32_Printer -Filter "Default = TRUE" -ErrorAction SilentlyContinue
  if ($null -eq $def) {
    throw "Nenhuma impressora padrao do Windows. Defina uma nas Configuracoes do app ou no Windows."
  }
  $PrinterName = $def.Name
}

$bytes = [System.IO.File]::ReadAllBytes($BinPath)
if ($bytes.Length -eq 0) {
  throw "Buffer vazio."
}

$code = @"
using System;
using System.Runtime.InteropServices;
public class LhgRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName = "LHG Cupom";
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile = null;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType = "RAW";
  }
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In][MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static void Send(string printerName, byte[] data) {
    IntPtr h = IntPtr.Zero;
    DOCINFOA di = new DOCINFOA();
    if (!OpenPrinter(printerName, out h, IntPtr.Zero))
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      if (!StartDocPrinter(h, 1, di))
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(h))
          throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        IntPtr p = Marshal.AllocCoTaskMem(data.Length);
        try {
          Marshal.Copy(data, 0, p, data.Length);
          int written;
          if (!WritePrinter(h, p, data.Length, out written))
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        } finally {
          Marshal.FreeCoTaskMem(p);
        }
      } finally {
        EndPagePrinter(h);
      }
    } finally {
      EndDocPrinter(h);
      ClosePrinter(h);
    }
  }
}
"@

Add-Type -TypeDefinition $code -Language CSharp
[LhgRawPrinter]::Send($PrinterName, $bytes)
