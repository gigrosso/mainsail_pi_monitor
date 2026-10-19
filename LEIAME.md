# Mainsail Pi Monitor

*[Read in English](README.md)*

Mostra a saúde do Raspberry Pi que roda o Klipper/Moonraker direto no **Mainsail**:

- **Barra superior** (ao lado do nome da impressora): uso da CPU, temperatura da CPU, uso de RAM e
  de armazenamento. Um ponto de status fica laranja quando a CPU está quente (≥ 70 °C) ou o Pi
  acusa throttling/subtensão. Passe o mouse para ver os detalhes (modelo, RAM/armazenamento em GB,
  tempo ligado, alertas de throttling).
- **Widget "Raspberry Pi" no Painel de controle**: modelo e tempo ligado, barras de CPU (com uma
  minibarra por núcleo), temperatura da CPU, RAM e armazenamento, aviso de throttling/subtensão e
  gráficos de 10 minutos do uso e da temperatura da CPU. Pode ser recolhido e acompanha o tema
  claro/escuro do Mainsail.
- **Posição do widget em Configurações > Painel de controle**: para cada tipo de tela (celular,
  tablet, desktop, widescreen) escolha se ele aparece, a coluna e depois de qual painel ele fica.
  A escolha é salva no banco do Moonraker e vale para todos os navegadores.
- Interface em **português ou inglês**, conforme o idioma do Mainsail.

É um único arquivo JavaScript que o Nginx injeta no Mainsail. **Nenhum serviço extra, nada de
Python, nenhum componente do Moonraker**: os dados vêm da própria conexão do Mainsail com o
Moonraker, então valem o mesmo login e as mesmas permissões do Mainsail.

## Requisitos

- Raspberry Pi (qualquer modelo; funciona também em outros hosts Linux, porque o Moonraker
  fornece os mesmos dados)
- Mainsail **v2.x** (testado no **v2.17.0**) servido pelo **Nginx** (MainsailOS, KIAUH…)
- Moonraker com os componentes padrão (`machine`, `file_manager`, `database`)

## Instalação

```bash
cd ~
unzip mainsail-pi-monitor.zip      # ou git clone <repositório>
cd mainsail-pi-monitor
./install.sh                       # pede sudo
```

Depois abra o Mainsail e aperte **Ctrl+Shift+R**. O Mainsail é um PWA e pode manter a página
antiga em cache.

O `install.sh`:

1. copia o `pi-monitor.js` para `/usr/local/share/mainsail-pi-monitor/`, fora da pasta do Mainsail,
   para que as atualizações do Mainsail não o apaguem;
2. faz backup do site do Nginx (`/etc/nginx/sites-available/mainsail.bak-pi-monitor.<data>`) e
   insere o trecho de `nginx/pi-monitor.conf` logo depois de `server {`;
3. roda `nginx -t` (e restaura o backup se falhar) e recarrega o Nginx.

Se o seu site do Nginx tiver outro nome, informe-o: `./install.sh /etc/nginx/sites-available/<nome>`.

### Instalação manual

1. `sudo install -D -m 644 pi-monitor.js /usr/local/share/mainsail-pi-monitor/pi-monitor.js`
2. Cole as linhas entre os marcadores de `nginx/pi-monitor.conf` dentro do bloco `server { … }` do
   site do Mainsail. Elas ficam no nível do server, **não** dentro de `location /`.
3. `sudo nginx -t && sudo systemctl reload nginx`

## Uso

- **Mover ou ocultar o widget:** Mainsail ▸ ⚙ Configurações ▸ **Painel de controle** ▸ escolha a aba
  do tipo de tela. Abaixo das colunas de painéis há uma caixa tracejada **Widget "Raspberry Pi"** com
  *mostrar*, *coluna*, *posição* e *padrão*. Sem escolha salva, o widget fica logo abaixo do painel
  de Status. Se o painel que ele segue estiver oculto, ele sobe para o painel visível mais próximo
  acima.
- **Recolher:** clique no cabeçalho do widget. Cada navegador lembra a escolha.

### Ajustes dentro do `pi-monitor.js`

| Constante | Padrão | Significado |
|---|---|---|
| `POLL_MS` | `5000` | intervalo de atualização de CPU/temperatura/RAM (ms) |
| `DISK_MS` | `60000` | intervalo de atualização do armazenamento (ms) |
| `HISTORY_MIN` | `10` | duração dos gráficos (minutos; guardado só no navegador) |
| `TEMP_WARN` / `TEMP_HOT` | `70` / `80` | temperatura da CPU para laranja / vermelho (°C) |
| `TOPBAR_FULL_MIN_PX` | `1400` | abaixo desta largura, a barra mostra só CPU e temperatura |
| `TOPBAR_MIN_PX` | `900` | abaixo desta largura, o item da barra some |

Depois de editar, rode `./install.sh` de novo. Se o Nginx já estiver configurado, ele só copia o arquivo.

## De onde vêm os dados

| O que aparece | Método do Moonraker |
|---|---|
| CPU % (total e por núcleo), temperatura da CPU, RAM, tempo ligado, throttling | `machine.proc_stats` |
| Modelo, núcleos, arquitetura | `machine.system_info` |
| Armazenamento | `server.files.get_directory` (raiz `gcodes` → `disk_usage`) |
| Posição do widget | `server.database.get_item` / `post_item` (namespace `mainsail`, chave `pi_monitor_widget`) |

O *armazenamento* é a partição onde fica a pasta `gcodes` (num Pi, normalmente o cartão SD ou o SSD).
O Pi tem um único sensor de temperatura, no SoC: essa é a "temperatura da CPU".

Se você restringe o acesso ao Moonraker com um proxy ou gateway, os usuários precisam ter leitura
nos três primeiros métodos. Salvar a posição exige `server.database.post_item` no namespace
`mainsail`, que qualquer usuário que já altera as configurações do próprio Mainsail tem.

## Limitações

- Depende de partes internas do Mainsail (instância raiz do Vue 2, `$socket`, `gui/getPanels`,
  classes CSS da v2.17). Uma versão futura do Mainsail, como uma migração para o Vue 3, pode exigir
  uma atualização deste script.
- A lista de layout do próprio Mainsail (a arrastável) só aceita os painéis embutidos. Por isso o
  widget tem uma caixa de posição própria.
- Os gráficos começam vazios a cada carregamento da página, porque o histórico fica só no navegador.

## Desinstalação

```bash
./uninstall.sh            # ou ./uninstall.sh /etc/nginx/sites-available/<nome>
```

Ele remove o trecho do Nginx (com backup e `nginx -t`), apaga `/usr/local/share/mainsail-pi-monitor`
e mostra como apagar a posição salva no banco do Moonraker.

## Licença

Copyright (C) 2026 Giovanni Grosso

Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo sob os termos da
**Licença Pública Geral GNU versão 3**, publicada pela Free Software Foundation, ou (a seu critério)
qualquer versão posterior. Ele é distribuído SEM NENHUMA GARANTIA. Veja [LICENSE](LICENSE). O texto
oficial da licença é o em inglês.
