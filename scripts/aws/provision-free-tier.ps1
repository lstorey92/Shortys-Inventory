param(
  [string]$Region = "us-east-1",
  [string]$KeyName = "shortys-inventory-key",
  [string]$InstanceName = "shortys-inventory-ec2",
  [string]$InstanceType = "t3.micro",
  [string]$SecurityGroupName = "shortys-inventory-sg",
  [string]$SshCidr = "0.0.0.0/0",
  [string]$IamInstanceProfileName = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Load-EnvFile([string]$Path) {
  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') {
      return
    }

    $parts = $_.Split('=', 2)
    if ($parts.Length -eq 2) {
      $name = $parts[0].Trim()
      $value = $parts[1].Trim()
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
  }
}

Load-EnvFile ".env.aws"

Write-Host "Using AWS region: $Region"

$identity = aws sts get-caller-identity --output json | ConvertFrom-Json
Write-Host "Authenticated as: $($identity.Arn)"

$vpcId = aws ec2 describe-vpcs --region $Region --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text
if (-not $vpcId -or $vpcId -eq "None") {
  throw "No default VPC found in region $Region."
}

$subnetId = aws ec2 describe-subnets --region $Region --filters Name=default-for-az,Values=true Name=vpc-id,Values=$vpcId --query "Subnets[0].SubnetId" --output text
if (-not $subnetId -or $subnetId -eq "None") {
  throw "No default subnet found in region $Region."
}

$sgId = aws ec2 describe-security-groups --region $Region --filters Name=group-name,Values=$SecurityGroupName Name=vpc-id,Values=$vpcId --query "SecurityGroups[0].GroupId" --output text
if (-not $sgId -or $sgId -eq "None") {
  Write-Host "Creating security group: $SecurityGroupName"
  $sgId = aws ec2 create-security-group --region $Region --group-name $SecurityGroupName --description "Shortys Inventory security group" --vpc-id $vpcId --query "GroupId" --output text
}

$sgDoc = aws ec2 describe-security-groups --region $Region --group-ids $sgId --output json | ConvertFrom-Json
$permissions = $sgDoc.SecurityGroups[0].IpPermissions

$sshRuleExists = $false
foreach ($permission in $permissions) {
  if ($permission.IpProtocol -eq "tcp" -and $permission.FromPort -eq 22 -and $permission.ToPort -eq 22) {
    $sshRuleExists = $true
    break
  }
}

if (-not $sshRuleExists) {
  aws ec2 authorize-security-group-ingress --region $Region --group-id $sgId --protocol tcp --port 22 --cidr $SshCidr | Out-Null
}

$httpRuleExists = $false
foreach ($permission in $permissions) {
  if ($permission.IpProtocol -eq "tcp" -and $permission.FromPort -eq 80 -and $permission.ToPort -eq 80) {
    $httpRuleExists = $true
    break
  }
}

if (-not $httpRuleExists) {
  aws ec2 authorize-security-group-ingress --region $Region --group-id $sgId --protocol tcp --port 80 --cidr 0.0.0.0/0 | Out-Null
}

$keyExists = $false
try {
  $null = aws ec2 describe-key-pairs --region $Region --key-names $KeyName --query "KeyPairs[0].KeyName" --output text 2>$null
  if ($LASTEXITCODE -eq 0) {
    $keyExists = $true
  }
} catch {
  $keyExists = $false
}

if (-not $keyExists) {
  Write-Host "Creating key pair: $KeyName"
  $keyMaterial = aws ec2 create-key-pair --region $Region --key-name $KeyName --query "KeyMaterial" --output text
  $keyPath = Join-Path (Get-Location) "$KeyName.pem"
  Set-Content -Path $keyPath -Value $keyMaterial -NoNewline
  Write-Host "Saved key pair to: $keyPath"
}

$amiId = ""
try {
  $amiId = aws ssm get-parameter --region $Region --name "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" --query "Parameter.Value" --output text 2>$null
} catch {
  $amiId = ""
}

if (-not $amiId -or $amiId -eq "None") {
  $amiId = aws ec2 describe-images --region $Region --owners amazon --filters Name=name,Values="al2023-ami-2023.*-x86_64" Name=state,Values=available --query "sort_by(Images,&CreationDate)[-1].ImageId" --output text
}

if (-not $amiId -or $amiId -eq "None") {
  throw "Unable to resolve Amazon Linux 2023 AMI in region $Region."
}

$runArgs = @(
  "ec2", "run-instances",
  "--region", $Region,
  "--image-id", $amiId,
  "--instance-type", $InstanceType,
  "--key-name", $KeyName,
  "--security-group-ids", $sgId,
  "--subnet-id", $subnetId,
  "--tag-specifications", "ResourceType=instance,Tags=[{Key=Name,Value=$InstanceName}]",
  "--query", "Instances[0].InstanceId",
  "--output", "text"
)

if ($IamInstanceProfileName) {
  $runArgs += @("--iam-instance-profile", "Name=$IamInstanceProfileName")
}

if ($DryRun) {
  $runArgs += "--dry-run"
}

$instanceId = aws @runArgs
if ($DryRun) {
  Write-Host "Dry run succeeded."
  exit 0
}

Write-Host "Created instance: $instanceId"
Write-Host "Waiting for instance to be running..."
aws ec2 wait instance-running --region $Region --instance-ids $instanceId

$publicIp = aws ec2 describe-instances --region $Region --instance-ids $instanceId --query "Reservations[0].Instances[0].PublicIpAddress" --output text
Write-Host "Instance Public IP: $publicIp"
Write-Host "Next: ssh -i ./$KeyName.pem ec2-user@$publicIp"
