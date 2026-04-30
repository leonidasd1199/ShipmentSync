/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

export type ColumnConfig<T> = {
    label: string
    accessor: keyof T
    CellTemplate?: ({ row }: { row: T }) => React.ReactNode
}

type ExpandableCardProps<T, K> = {
    data: T
    columnConfig: ColumnConfig<T>[]
    expandedData?: K[]
    expandedColumnConfig?: ColumnConfig<K>[]
    action?: React.ReactNode
}

export default function ExpandableCard<T, K>({
    data,
    columnConfig,
    expandedData = [],
    expandedColumnConfig = [],
    action
}: ExpandableCardProps<T, K>) {

    const [expanded, setExpanded] = useState(false)

    const renderCell = (row: any, column: any) => {
        if (column.CellTemplate) {
            return <column.CellTemplate row={row} />
        }

        return row[column.accessor] ?? "-"
    }

    return (
        <div
            className="
      bg-white
      border-4
      border-[#6f1616]
      rounded-lg
      p-6
      space-y-6
      shadow-sm
    "
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                {columnConfig.map((col) => (
                    <div key={String(col.accessor)} className="flex flex-col gap-1">

                        <div className="text-lg font-semibold text-[#3d0202] break-words">
                            {renderCell(data, col)}
                        </div>

                        <div className="text-sm font-medium text-black">
                            {col.label}
                        </div>

                    </div>
                ))}

            </div>

            {/* ACTION BAR */}
            <div className="flex justify-between items-center pt-2">

                <button
                    onClick={() => setExpanded(!expanded)}
                    className="
          flex items-center gap-2
          text-sm
          bg-white
          border border-neutral-300
          px-4 py-2
          rounded-md
          shadow-sm
          hover:bg-neutral-100
          transition
        "
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Details
                </button>

                {action}

            </div>
            {expanded && expandedData.length > 0 && (

                <div className="border-t border-neutral-200 pt-4 overflow-x-auto">

                    <table className="w-full text-sm">

                        <thead>

                            <tr className="text-neutral-500 text-xs">

                                {expandedColumnConfig.map((col) => (

                                    <th
                                        key={String(col.accessor)}
                                        className="text-left pb-2 font-medium"
                                    >
                                        {col.label}
                                    </th>

                                ))}

                            </tr>

                        </thead>

                        <tbody>

                            {expandedData.map((row, i) => (

                                <tr key={i} className="border-t border-neutral-200">

                                    {expandedColumnConfig.map((col) => (

                                        <td
                                            key={String(col.accessor)}
                                            className="py-2 break-words"
                                        >
                                            {renderCell(row, col)}
                                        </td>

                                    ))}

                                </tr>

                            ))}

                        </tbody>

                    </table>

                </div>

            )}

        </div>
    )
}