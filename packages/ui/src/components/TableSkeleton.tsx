import { Skeleton, Table } from "@chakra-ui/react";

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}) {
  return (
    <Table.Root size="sm">
      {showHeader && (
        <Table.Header>
          <Table.Row>
            {Array.from({ length: columns }).map((_, i) => (
              <Table.ColumnHeader key={i}>
                <Skeleton height="4" width="80%" />
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>
      )}
      <Table.Body>
        {Array.from({ length: rows }).map((_, row) => (
          <Table.Row key={row}>
            {Array.from({ length: columns }).map((_, col) => (
              <Table.Cell key={col}>
                <Skeleton height="4" width={col === 0 ? "70%" : "50%"} />
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
