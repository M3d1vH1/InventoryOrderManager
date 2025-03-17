import React from 'react';

// Minimal Table component (replace with your actual Table component)
const Table = ({ children, className }) => (
  <table className={className}>
    <tbody>{children}</tbody>
  </table>
);

const TableHeader = ({ children }) => (
  <thead>{children}</thead>
);

const TableRow = ({ children, className }) => (
  <tr className={className}>{children}</tr>
);

const App = () => {
  return (
    <div className="container mx-auto px-4">
      <div className="space-y-4">
        <Table className="touch-manipulation">
          <TableHeader>
            <TableRow className="h-14">
              <th>Order ID</th>
              <th>Amount</th>
            </TableRow>
          </TableHeader>
          <tbody>
            <TableRow>
              <td>123</td>
              <td>$100</td>
            </TableRow>
            <TableRow>
              <td>456</td>
              <td>$200</td>
            </TableRow>
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default App;