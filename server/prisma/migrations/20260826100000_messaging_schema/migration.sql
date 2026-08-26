-- Stage 3: Conversation / Message / ConversionEvent tables + Expense table

-- Expenses (schema stub, UI pending)
CREATE TABLE expenses (
  id VARCHAR(191) NOT NULL,
  category VARCHAR(191) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description LONGTEXT NULL,
  expense_date DATETIME(3) NOT NULL,
  recorded_by_id VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX expenses_expense_date_idx (expense_date),
  CONSTRAINT expenses_recorded_by_id_fkey FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Conversations
CREATE TABLE conversations (
  id VARCHAR(191) NOT NULL,
  channel VARCHAR(191) NOT NULL,
  integration_account_id VARCHAR(191) NOT NULL,
  customer_id VARCHAR(191) NULL,
  remote_id VARCHAR(191) NOT NULL,
  display_name VARCHAR(191) NOT NULL,
  last_message_at DATETIME(3) NOT NULL,
  unread_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX conversations_integration_account_id_remote_id_key (integration_account_id, remote_id),
  INDEX conversations_last_message_at_idx (last_message_at),
  CONSTRAINT conversations_integration_account_id_fkey FOREIGN KEY (integration_account_id) REFERENCES integration_accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT conversations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Messages
CREATE TABLE messages (
  id VARCHAR(191) NOT NULL,
  conversation_id VARCHAR(191) NOT NULL,
  direction ENUM('inbound','outbound') NOT NULL,
  body LONGTEXT NULL,
  media_type VARCHAR(191) NULL,
  media_url LONGTEXT NULL,
  wa_message_id VARCHAR(191) NULL,
  sent_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX messages_wa_message_id_key (wa_message_id),
  INDEX messages_conversation_id_sent_at_idx (conversation_id, sent_at),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Conversion events (CAPI log)
CREATE TABLE conversion_events (
  id VARCHAR(191) NOT NULL,
  order_id VARCHAR(191) NOT NULL,
  customer_id VARCHAR(191) NOT NULL,
  event_name VARCHAR(191) NOT NULL,
  channel VARCHAR(191) NOT NULL,
  ctwa_clid VARCHAR(191) NULL,
  messenger_psid VARCHAR(191) NULL,
  payload LONGTEXT NOT NULL,
  response_status INT NULL,
  response_body LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX conversion_events_order_id_key (order_id),
  INDEX conversion_events_order_id_idx (order_id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
