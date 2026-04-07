# Atualizacao sem reinstalar (LHG SYSTEM)

## 1) Onde ficam os dados (nao perdem no update)

Os dados do sistema sao salvos fora da pasta do programa:

- `%APPDATA%/lhg-system/lhg-data/state.json`
- Backups automaticos em `%APPDATA%/lhg-system/lhg-data/backups/`

## 2) Publicar uma nova versao (GitHub Releases)

1. Atualize o campo `version` em `package.json`.
2. Gere os artefatos de update:
   - `npm run build:exe:publish`
3. O `electron-builder` vai criar/atualizar um Release no GitHub com:
   - `LHG SYSTEM Setup <versao>.exe`
   - `LHG SYSTEM Setup <versao>.exe.blockmap`
   - `latest.yml`
   - (e demais arquivos de update necessários)

## 3) Token do GitHub (obrigatorio para publicar)

Antes de rodar o publish, defina a variavel de ambiente `GH_TOKEN` (um Personal Access Token com permissao de `repo`):

- PowerShell (exemplo):
  - `$env:GH_TOKEN="SEU_TOKEN_AQUI"`
  - `npm run build:exe:publish`

## 4) Config do repositorio

No `package.json`, ajuste:

- `repository.url`
- `build.publish.owner`
- `build.publish.repo`

## 5) Como o cliente atualiza

- O app checa atualizacoes ao iniciar.
- Depois, checa novamente a cada 15 minutos.
- Quando baixar nova versao, pergunta se deseja reiniciar para atualizar.
