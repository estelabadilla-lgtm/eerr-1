# Actualiza data_ventas.json con los CSV del RCV de Ventas del SII (mes actual y anterior).
# Toma el CSV mas reciente de cada periodo en Descargas y reemplaza esos meses en el JSON.
# Replica parseCSV() de libro_ventas.html.
param(
  [string]$Rut = '99582120-6',
  [string]$Downloads = (Join-Path $env:USERPROFILE 'Downloads')
)
$ErrorActionPreference = 'Stop'
$jsonPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'data_ventas.json'

$hoy = Get-Date
$periodos = @($hoy.AddMonths(-1).ToString('yyyyMM'), $hoy.ToString('yyyyMM'))

$files = foreach ($p in $periodos) {
  Get-ChildItem $Downloads -Filter "RCV_VENTA_${Rut}_$p*.csv" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $files) { throw "No hay CSV RCV_VENTA en $Downloads para $($periodos -join ', ')" }

function N($x) { $s = ($x -replace '[^0-9\-]', ''); $v = 0L; if ([int64]::TryParse($s, [ref]$v)) { $v } else { 0L } }
function T($c, $i) { if ($i -lt $c.Length -and $c[$i]) { $c[$i].Trim() } else { '' } }

$new = New-Object System.Collections.ArrayList
foreach ($f in $files) {
  $lines = [IO.File]::ReadAllLines($f.FullName, [Text.Encoding]::UTF8) | Where-Object { $_.Trim() }
  for ($i = 1; $i -lt $lines.Count; $i++) {
    $c = $lines[$i].Split(';')
    if ($c.Length -lt 14) { continue }
    $fechaRaw = if ($c[6]) { $c[6].Split(' ')[0].Trim() } else { '' }
    $iso = ''
    if ($fechaRaw) { $p = $fechaRaw.Split('/'); if ($p.Count -eq 3) { $iso = '{0}-{1}-{2}' -f $p[2], $p[1].PadLeft(2,'0'), $p[0].PadLeft(2,'0') } }
    $fr = T $c 9
    [void]$new.Add([ordered]@{
      tipo = T $c 1; rut = T $c 3; razon = T $c 4; folio = T $c 5
      fecha = $iso; fechaRaw = $fechaRaw; mes = if ($iso) { $iso.Substring(0,7) } else { '' }
      exento = N $c[10]; neto = N $c[11]; iva = N $c[12]; total = N $c[13]
      fechaReclamo = $fr; tipoRef = T $c 24; folioRef = T $c 25; rechazada = [bool]$fr
    })
  }
}
$meses = @($new | ForEach-Object { $_.mes } | Where-Object { $_ } | Sort-Object -Unique)
$old = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
$kept = @($old | Where-Object { $meses -notcontains $_.mes })
$all = @($kept) + @($new)
[IO.File]::WriteAllText($jsonPath, (ConvertTo-Json -InputObject $all -Compress -Depth 3), (New-Object Text.UTF8Encoding $false))

"Archivos: $($files.Name -join ', ')"
foreach ($m in $meses) {
  $rows = @($new | Where-Object { $_.mes -eq $m })
  "{0}: {1} docs, neto {2:N0}" -f $m, $rows.Count, ($rows | ForEach-Object { $_.neto } | Measure-Object -Sum).Sum
}
"Total registros: $($all.Count)"
