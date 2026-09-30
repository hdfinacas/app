[CmdletBinding()]
param(
  [string]$OldDbUrl = $env:CREDMAIS_OLD_DB_URL,
  [string]$NewDbUrl = $env:CREDMAIS_NEW_DB_URL,
  [string]$DumpFile = (Join-Path $PSScriptRoot '..\backups\credmaisapp-migracao.dump'),
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Comando '$Name' não encontrado. Instale o PostgreSQL client (pg_dump/pg_restore)."
  }
}

if (-not $OldDbUrl -or -not $NewDbUrl) {
  throw 'Defina CREDMAIS_OLD_DB_URL e CREDMAIS_NEW_DB_URL antes de executar.'
}

Require-Command 'pg_dump'
Require-Command 'pg_restore'

$resolvedDump = [IO.Path]::GetFullPath($DumpFile)
$dumpDirectory = Split-Path -Parent $resolvedDump
New-Item -ItemType Directory -Force -Path $dumpDirectory | Out-Null

Write-Host 'Migração segura do CredMais'
Write-Host "Origem: projeto Supabase antigo (somente leitura)"
Write-Host "Destino: Supabase no VPS (novo ambiente)"
Write-Host "Arquivo local: $resolvedDump"
Write-Host 'Nenhum comando de exclusão será executado na origem.'

if (-not $Execute) {
  Write-Host ''
  Write-Host 'Prévia concluída. Para exportar e importar, execute novamente com -Execute.'
  exit 0
}

if (Test-Path $resolvedDump) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $archive = "$resolvedDump.$stamp.bak"
  Move-Item -LiteralPath $resolvedDump -Destination $archive
  Write-Host "Backup do dump anterior preservado em: $archive"
}

Write-Host 'Exportando o banco antigo...'
& pg_dump --dbname=$OldDbUrl --format=custom --file=$resolvedDump --no-owner --no-privileges --verbose
if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou com código $LASTEXITCODE." }

Write-Host 'Importando no banco novo...'
& pg_restore --dbname=$NewDbUrl --no-owner --no-privileges --exit-on-error --verbose $resolvedDump
if ($LASTEXITCODE -ne 0) { throw "pg_restore falhou com código $LASTEXITCODE. O banco antigo permanece intacto; revise o log e o banco novo." }

Write-Host 'Banco importado. Valide tabelas, usuários, RLS, funções, webhooks e Storage antes de trocar o domínio.'
