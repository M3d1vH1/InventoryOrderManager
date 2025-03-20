CREATE TYPE "public"."changelog_action" AS ENUM('create', 'update', 'delete', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'picked', 'shipped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shipping_company" AS ENUM('dhl', 'fedex', 'ups', 'usps', 'royal_mail', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'front_office', 'warehouse');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vat_number" text,
	"address" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"email" text,
	"phone" text,
	"contact_person" text,
	"preferred_shipping_company" "shipping_company",
	"custom_shipping_company" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_changelogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" "changelog_action" NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"changes" json,
	"previous_values" json,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"has_shipping_document" boolean DEFAULT false NOT NULL,
	"created_by_id" integer NOT NULL,
	"updated_by_id" integer,
	"last_updated" timestamp,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"product_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "product_tags_product_id_tag_id_pk" PRIMARY KEY("product_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"category_id" integer NOT NULL,
	"description" text,
	"min_stock_level" integer DEFAULT 10 NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"location" text,
	"units_per_box" integer,
	"image_path" text,
	"tags" text[],
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "shipping_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"document_path" text NOT NULL,
	"document_type" text NOT NULL,
	"upload_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "shipping_documents_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "unshipped_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_id" text,
	"original_order_number" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"shipped" boolean DEFAULT false NOT NULL,
	"shipped_in_order_id" integer,
	"shipped_at" timestamp,
	"authorized" boolean DEFAULT false NOT NULL,
	"authorized_by_id" integer,
	"authorized_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'front_office' NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
