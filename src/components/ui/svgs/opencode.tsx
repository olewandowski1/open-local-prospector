import type { SVGProps } from "react"

// The outline inherits text colour; filled background squares belong only to the app icon.
const Opencode = (props: SVGProps<SVGSVGElement>) => (
  <svg {...props} preserveAspectRatio="xMidYMid" viewBox="0 0 512 512">
    <title>OpenCode</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
    />
  </svg>
)

export { Opencode }
