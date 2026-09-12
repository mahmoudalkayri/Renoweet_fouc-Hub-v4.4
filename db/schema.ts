import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const focusHubState = sqliteTable("focus_hub_state", {
  ownerKey: text("owner_key").primaryKey(),
  schemaVersion: integer("schema_version").notNull().default(1),
  payloadJson: text("payload_json").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
});
