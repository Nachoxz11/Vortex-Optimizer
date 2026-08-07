param(
  [int]$DurationDays = 0
)

$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
$bytes = New-Object byte[] 16
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$groups = 0..3 | ForEach-Object {
  $group = $_
  -join (0..3 | ForEach-Object {
    $position = $_
    $alphabet[$bytes[($group * 4) + $position] % $alphabet.Length]
  })
}
$key = "VX-$($groups -join '-')"
$sha = [System.Security.Cryptography.SHA256]::Create()
$hash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($key))).Replace('-', '')).ToLowerInvariant()
$duration = if ($DurationDays -gt 0) { $DurationDays } else { 'NULL' }

Write-Output "KEY=$key"
Write-Output "SQL=insert into public.premium_keys (key_hash, duration_days) values ('$hash', $duration);"
