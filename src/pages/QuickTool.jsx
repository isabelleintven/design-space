import { getTool } from '../tools'

export default function QuickTool({ toolId, query }) {
  const tool = getTool(toolId)
  if (!tool || tool.soon)
    return (
      <div className="empty" style={{ paddingTop: 120 }}>
        <span className="big">Deze tool bestaat (nog) niet</span>
        <a href="#/">Terug naar Quick Tools</a>
      </div>
    )
  const Tool = tool.component
  return (
    <>
      <div className="page-head">
        <div className="crumbs">
          <a href="#/">Quick Tools</a> / <span>{tool.name}</span>
        </div>
        <div className="eyebrow">{tool.category}</div>
        <h1>{tool.name}</h1>
        <p>{tool.desc}</p>
      </div>
      <Tool project={null} query={query} />
    </>
  )
}
