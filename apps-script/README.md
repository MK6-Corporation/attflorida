# Recebimento das reservas e passaportes (Google Drive)

O formulário do site envia cada reserva para um script do Google, na conta Google da ATT Florida.
Para cada reserva ele:
- cria uma pasta no Drive com o nome do cliente e salva os passaportes dentro dela;
- adiciona uma linha na planilha "ATT Florida – Reservations", com o link da pasta;
- (opcional) manda um e-mail de aviso para a equipe.

## Passo a passo (uns 10 minutos)
1. Entre em https://script.google.com com a conta Google da empresa e clique em **New project**.
2. Apague o conteúdo do editor e cole todo o arquivo `Code.gs`.
3. Se quiser aviso por e-mail, preencha `NOTIFY_EMAIL` com o e-mail da equipe.
4. Escolha a função `setup` no menu do topo e clique em **Run**. Autorize o acesso (Drive, Planilhas e Gmail).
   Isso cria a pasta "ATT Florida – Reservations" e a planilha dentro dela.
5. Clique em **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copie a URL do Web app (termina em `/exec`).
7. No site, abra `assets/site.js` e cole a URL em `const FORM_ENDPOINT = "";`.

Enquanto `FORM_ENDPOINT` estiver vazio, o formulário funciona em modo de prévia e não envia nada.

## Segurança
- As pastas ficam privadas na conta da empresa. Não compartilhe a pasta raiz com "qualquer pessoa com o link".
- Os passaportes são dados sensíveis: dê acesso só a quem atende os clientes.
- Se mudar o código depois, use **Deploy → Manage deployments → Edit → New version** para manter a mesma URL.
