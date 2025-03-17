
import { Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

const OrderTrends = () => {
  const { data: orders } = useQuery({
    queryKey: ['/api/orders'],
  });

  const ordersByDate = orders?.reduce((acc: any, order: any) => {
    const date = new Date(order.orderDate).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(ordersByDate || {}).map(([date, count]) => ({
    date,
    orders: count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <Line
            data={chartData}
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            xDataKey="date"
            yDataKey="orders"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderTrends;
