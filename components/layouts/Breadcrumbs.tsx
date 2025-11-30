"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Home } from "lucide-react"

interface BreadcrumbsProps {
  items?: Array<{ label: string; href?: string }>
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const pathname = usePathname()

  const generateBreadcrumbs = () => {
    if (items) return items

    const paths = pathname?.split("/").filter(Boolean) || []
    const breadcrumbs = [
      {
        label: "Home",
        href: "/",
      },
    ]

    let currentPath = ""
    paths.forEach((path, index) => {
      currentPath += `/${path}`
      const isLast = index === paths.length - 1
      breadcrumbs.push({
        label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " "),
        href: isLast ? undefined : currentPath,
      })
    })

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1
          return (
            <React.Fragment key={item.href || item.label}>
              <BreadcrumbItem>
                {index === 0 ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href || "/"}>
                      <Home className="h-4 w-4" />
                    </Link>
                  </BreadcrumbLink>
                ) : isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href || "#"}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

