import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

interface SlackMessage {
    channel?: string;
    text: string;
    blocks?: SlackBlock[];
}

interface SlackBlock {
    type: "section" | "divider" | "header" | "context";
    text?: { type: "mrkdwn" | "plain_text"; text: string };
    fields?: { type: "mrkdwn"; text: string }[];
}

async function sendSlack(message: SlackMessage): Promise<boolean> {
    const webhookUrl = env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.warn("Slack webhook not configured, skipping notification");
        return false;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            logger.error("Slack notification failed", {
                status: response.status,
                body: await response.text(),
            });
            return false;
        }
        return true;
    } catch (err) {
        logger.error("Slack notification error", { error: (err as Error).message });
        return false;
    }
}

// ── Pre-built notification templates ──────────────────────────────────────────

export async function notifyNewOrder(order: {
    orderNumber: string;
    customerName: string;
    totalAmount: number;
    itemCount: number;
    priority: string;
}) {
    const priorityEmoji =
        order.priority === "urgent" ? "🔴" : order.priority === "high" ? "🟡" : "🟢";

    return sendSlack({
        text: `New order: ${order.orderNumber}`,
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: `${priorityEmoji} New Order: ${order.orderNumber}` },
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*Customer:*\n${order.customerName}` },
                    { type: "mrkdwn", text: `*Amount:*\n€${order.totalAmount.toFixed(2)}` },
                    { type: "mrkdwn", text: `*Items:*\n${order.itemCount}` },
                    { type: "mrkdwn", text: `*Priority:*\n${order.priority}` },
                ],
            },
        ],
    });
}

export async function notifyOrderShipped(order: {
    orderNumber: string;
    customerName: string;
    trackingNumber?: string;
}) {
    return sendSlack({
        text: `Order shipped: ${order.orderNumber}`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `📦 *Order Shipped:* ${order.orderNumber}\n*Customer:* ${order.customerName}${order.trackingNumber ? `\n*Tracking:* ${order.trackingNumber}` : ""
                        }`,
                },
            },
        ],
    });
}

export async function notifyLowStock(products: {
    name: string;
    sku: string;
    available: number;
    minLevel: number;
}[]) {
    if (products.length === 0) return false;
    const productList = products
        .map((p) => `• *${p.name}* (${p.sku}): ${p.available} left (min: ${p.minLevel})`)
        .join("\n");

    return sendSlack({
        text: `⚠️ Low stock alert: ${products.length} products`,
        blocks: [
            { type: "header", text: { type: "plain_text", text: "⚠️ Low Stock Alert" } },
            { type: "section", text: { type: "mrkdwn", text: productList } },
        ],
    });
}

export async function notifyDailySummary(stats: {
    ordersCreated: number;
    ordersShipped: number;
    revenue: number;
    pickingQueue: number;
    lowStockCount: number;
}) {
    return sendSlack({
        text: `Daily summary: ${stats.ordersCreated} orders, €${stats.revenue.toFixed(2)} revenue`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `📊 Daily Summary — ${new Date().toLocaleDateString("el-GR")}`,
                },
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*Orders Created:*\n${stats.ordersCreated}` },
                    { type: "mrkdwn", text: `*Orders Shipped:*\n${stats.ordersShipped}` },
                    { type: "mrkdwn", text: `*Revenue:*\n€${stats.revenue.toFixed(2)}` },
                    { type: "mrkdwn", text: `*Picking Queue:*\n${stats.pickingQueue}` },
                ],
            },
            stats.lowStockCount > 0
                ? { type: "context", text: { type: "mrkdwn", text: `⚠️ ${stats.lowStockCount} products below minimum stock level` } }
                : { type: "divider" },
        ],
    });
}

export async function notifyError(error: { message: string; context?: string }) {
    return sendSlack({
        text: `❌ System Error: ${error.message}`,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `❌ *System Error*\n\`\`\`${error.message}\`\`\`${error.context ? `\n*Context:* ${error.context}` : ""
                        }`,
                },
            },
        ],
    });
}
