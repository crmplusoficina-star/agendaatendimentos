# Agenda de Atendimentos

Aplicação de agenda operacional por filial para consultores, gestores e administração.

## Fluxo principal

- Login por matrícula + senha.
- Consultor enxerga somente as filiais associadas à matrícula.
- Gestor enxerga todas as filiais em modo somente leitura.
- Administrador enxerga e administra todas as filiais.
- Agenda semanal em grade, no estilo Excel: clique na célula, escolha status e valor, salve.
- Técnico adicional pode ser criado apenas digitando o nome.
- Busca de equipamento por número de série.
- Controle rápido de faturamento.

## Supabase

Projeto: `zwxpbqutymrnkipesnbs`

As migrações estão em `supabase/migrations`.

### Autenticação

O frontend apresenta apenas o campo **Matrícula**, mas internamente usa Supabase Auth com um e-mail técnico no formato:

`<matricula>@agenda.local`

Exemplo: matrícula `19124` -> `19124@agenda.local`.

Os perfis e permissões já são cadastrados na tabela `app_users`. Ao criar o usuário correspondente no Supabase Auth, um trigger vincula automaticamente o `auth_user_id` pela matrícula.

> Não use a matrícula como senha. Crie senhas individuais e seguras para cada usuário.

## Rodar localmente

```bash
npm install
npm run dev
```

O projeto já possui valores padrão para a URL e a chave **publishable** do Supabase. Em produção, prefira configurar as variáveis de ambiente descritas em `.env.example`.
