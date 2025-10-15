# Controle de Estoque com Angular e Supabase

Este projeto foi configurado para usar o Supabase como seu backend. Siga os passos abaixo para configurar o ambiente e rodar a aplicação.

## Passo 1: Configurar o Projeto Supabase

Se você já criou um projeto no Supabase e tem a URL e a chave `anon public`, pode pular para o Passo 2.

1.  Acesse [supabase.com](https://supabase.com/) e crie uma nova conta ou faça login.
2.  Clique em **"New Project"** e siga as instruções para criar um novo projeto.
3.  Guarde a senha do seu banco de dados em um local seguro.

## Passo 2: Obter as Credenciais da API

Após a criação do projeto, você precisa obter a URL da API e a chave `anon public`.

1.  No painel do seu projeto Supabase, vá para **Settings** (ícone de engrenagem) > **API**.
2.  Na seção **Project API Keys**, você encontrará:
    *   **URL** do Projeto
    *   **anon public** key
3.  Essas credenciais já foram inseridas no arquivo `src/services/supabase.client.ts`. Se precisar alterá-las, faça isso lá.

## Passo 3: Configurar o Esquema do Banco de Dados

Esta é a etapa mais importante. Você precisa criar as tabelas e funções no seu banco de dados Supabase para que a aplicação funcione corretamente.

1.  No painel do seu projeto Supabase, vá para o **SQL Editor** (ícone `</>`).
2.  Clique em **"+ New query"**.
3.  Copie **todo o conteúdo do script SQL abaixo** e cole no editor de SQL.
4.  Clique em **"RUN"** para executar o script. Isso criará todas as tabelas, relacionamentos e funções necessárias.

---

### Script SQL Completo

```sql
-- Habilita a extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types (Tipos Enumerados)
CREATE TYPE "user_role" AS ENUM ('Admin', 'User');
CREATE TYPE "strategic_sector" AS ENUM ('Bombeiros', 'Civil', 'Hidraulica', 'Eletrica', 'Mecanica');
CREATE TYPE "purchase_order_status" AS ENUM ('Rascunho', 'Enviado', 'Recebido Parcialmente', 'Recebido', 'Cancelado');
CREATE TYPE "picking_list_status" AS ENUM ('Pendente', 'Em Coleta', 'Concluida');
CREATE TYPE "reservation_status" AS ENUM ('Pendente', 'Atendida', 'Cancelada');

-- Tabela de Fornecedores (Suppliers)
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact TEXT,
    cnpj TEXT UNIQUE,
    address TEXT,
    responsible_name TEXT
);

-- Tabela de Técnicos (Technicians)
CREATE TABLE technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    password TEXT
);

-- Tabela de Itens (Items)
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0,
    reorder_point INTEGER NOT NULL DEFAULT 0,
    preferred_supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Itens da Prateleira Vermelha (Red Shelf Items)
CREATE TABLE red_shelf_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    sector strategic_sector NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Movimentações (Movements)
CREATE TABLE movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    quantity INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,
    notes TEXT
);

-- Tabela de Usuários (Users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    permissions TEXT[]
);

-- Tabela de Ordens de Compra (Purchase Orders)
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    po_number TEXT UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status purchase_order_status NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

-- Tabela de Listas de Coleta (Picking Lists)
CREATE TABLE picking_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    status picking_list_status NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Kits
CREATE TABLE kits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    components JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Reservas (Reservations)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    technician_id UUID NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    status reservation_status NOT NULL,
    items JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Log de Auditoria (Audit Logs)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "action" TEXT NOT NULL,
    details TEXT,
    "user" TEXT
);

-- Tabela de Categorias
CREATE TABLE categories (
    name TEXT PRIMARY KEY
);

-- Habilita Row Level Security (RLS) para todas as tabelas
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_shelf_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE picking_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: Permite leitura pública (anon) para todas as tabelas
CREATE POLICY "Public read access" ON suppliers FOR SELECT USING (true);
CREATE POLICY "Public read access" ON technicians FOR SELECT USING (true);
CREATE POLICY "Public read access" ON items FOR SELECT USING (true);
CREATE POLICY "Public read access" ON red_shelf_items FOR SELECT USING (true);
CREATE POLICY "Public read access" ON movements FOR SELECT USING (true);
CREATE POLICY "Public read access" ON users FOR SELECT USING (true);
CREATE POLICY "Public read access" ON purchase_orders FOR SELECT USING (true);
CREATE POLICY "Public read access" ON picking_lists FOR SELECT USING (true);
CREATE POLICY "Public read access" ON kits FOR SELECT USING (true);
CREATE POLICY "Public read access" ON reservations FOR SELECT USING (true);
CREATE POLICY "Public read access" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON categories FOR SELECT USING (true);

-- Políticas de RLS: Permite que usuários anônimos (a aplicação) façam todas as operações
CREATE POLICY "Allow all anon" ON suppliers FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON technicians FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON items FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON red_shelf_items FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON movements FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON users FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON purchase_orders FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON picking_lists FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON kits FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON reservations FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Allow all anon" ON categories FOR ALL USING (true);

-- Insere um usuário administrador padrão
INSERT INTO users (username, password_hash, role, permissions)
VALUES ('admin', 'YWRtaW4xMjM=', 'Admin', '{}'); -- senha é 'admin123' em base64

-- Insere categorias padrão
INSERT INTO categories (name) VALUES
('Ferramentas'),
('Componentes Eletrônicos'),
('Material de Escritório'),
('Limpeza'),
('Segurança'),
('Redes'),
('Outros');


-- FUNÇÃO RPC PARA ADICIONAR MOVIMENTAÇÃO DE FORMA ATÔMICA
CREATE OR REPLACE FUNCTION add_movement(
    p_item_id UUID,
    p_type TEXT,
    p_quantity INTEGER,
    p_date TIMESTAMPTZ,
    p_technician_id UUID,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    current_stock INTEGER;
    is_red_shelf BOOLEAN;
    updated_item JSONB;
    new_movement JSONB;
BEGIN
    -- Determina se o item está na prateleira vermelha ou no inventário principal
    SELECT NOT EXISTS(SELECT 1 FROM items WHERE id = p_item_id) INTO is_red_shelf;

    IF is_red_shelf THEN
        -- Bloqueia a linha para evitar condições de corrida
        SELECT quantity INTO current_stock FROM red_shelf_items WHERE id = p_item_id FOR UPDATE;
        IF current_stock IS NULL THEN RAISE EXCEPTION 'Item não encontrado na Prateleira Vermelha.'; END IF;
        IF p_type = 'out' AND current_stock < p_quantity THEN RAISE EXCEPTION 'Estoque insuficiente na Prateleira Vermelha.'; END IF;

        UPDATE red_shelf_items
        SET quantity = quantity + (CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END)
        WHERE id = p_item_id
        RETURNING to_jsonb(red_shelf_items.*) INTO updated_item;
    ELSE
        SELECT quantity INTO current_stock FROM items WHERE id = p_item_id FOR UPDATE;
        IF current_stock IS NULL THEN RAISE EXCEPTION 'Item não encontrado no Inventário.'; END IF;
        IF p_type = 'out' AND current_stock < p_quantity THEN RAISE EXCEPTION 'Estoque insuficiente no Inventário.'; END IF;

        UPDATE items
        SET quantity = quantity + (CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END)
        WHERE id = p_item_id
        RETURNING to_jsonb(items.*) INTO updated_item;
    END IF;

    -- Insere o registro da movimentação
    INSERT INTO movements(item_id, type, quantity, date, technician_id, notes)
    VALUES (p_item_id, p_type, p_quantity, p_date, p_technician_id, p_notes)
    RETURNING to_jsonb(movements.*) INTO new_movement;

    RETURN jsonb_build_object('newMovement', new_movement, 'updatedItem', updated_item);
END;
$$;


-- FUNÇÃO RPC PARA AJUSTAR QUANTIDADE DE FORMA ATÔMICA
CREATE OR REPLACE FUNCTION adjust_quantity(
    p_item_id UUID,
    p_new_quantity INTEGER,
    p_notes TEXT,
    p_is_red_shelf BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    old_quantity INTEGER;
    quantity_change INTEGER;
    movement_type TEXT;
    updated_item JSONB;
    new_movement JSONB;
BEGIN
    IF p_is_red_shelf THEN
        SELECT quantity INTO old_quantity FROM red_shelf_items WHERE id = p_item_id FOR UPDATE;
        IF old_quantity IS NULL THEN RAISE EXCEPTION 'Item não encontrado na Prateleira Vermelha.'; END IF;
        
        quantity_change := p_new_quantity - old_quantity;
        IF quantity_change = 0 THEN RAISE EXCEPTION 'Nenhuma alteração na quantidade.'; END IF;

        UPDATE red_shelf_items SET quantity = p_new_quantity WHERE id = p_item_id
        RETURNING to_jsonb(red_shelf_items.*) INTO updated_item;
    ELSE
        SELECT quantity INTO old_quantity FROM items WHERE id = p_item_id FOR UPDATE;
        IF old_quantity IS NULL THEN RAISE EXCEPTION 'Item não encontrado no Inventário.'; END IF;
        
        quantity_change := p_new_quantity - old_quantity;
        IF quantity_change = 0 THEN RAISE EXCEPTION 'Nenhuma alteração na quantidade.'; END IF;

        UPDATE items SET quantity = p_new_quantity WHERE id = p_item_id
        RETURNING to_jsonb(items.*) INTO updated_item;
    END IF;
    
    movement_type := CASE WHEN quantity_change > 0 THEN 'in' ELSE 'out' END;
    
    INSERT INTO movements(item_id, type, quantity, date, technician_id, notes)
    VALUES (p_item_id, movement_type, abs(quantity_change), now(), NULL, p_notes)
    RETURNING to_jsonb(movements.*) INTO new_movement;

    RETURN jsonb_build_object('newMovement', new_movement, 'updatedItem', updated_item);
END;
$$;
```

---

## Passo 4: Rodar a Aplicação

Depois de executar o script SQL, sua aplicação estará pronta para ser usada. Inicie-a e ela se conectará automaticamente ao seu backend Supabase.

**Observação:** Os provedores de dados antigos (`LocalStorageProvider` e `HttpProvider`) ainda existem no código, mas não estão sendo utilizados. Você pode removê-los se desejar.