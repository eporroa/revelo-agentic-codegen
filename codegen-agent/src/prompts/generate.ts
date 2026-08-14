/**
 * Structured per-task generation prompt: role + task + scoped context +
 * expected export shape + a style few-shot + an explicit output-format
 * constraint (plan.md's Prompt design conventions).
 *
 * The few-shot below illustrates *coding style* (functional component,
 * named default export, hooks-first data access) — it intentionally
 * contains no field/feature names from any reference spec, so it never
 * becomes a source of hardcoding (constitution principle VI). The actual
 * file contents this task depends on (passed via `dependencyFileContents`)
 * always take precedence over the few-shot when the two disagree on style.
 */

const STYLE_FEW_SHOT = `// Example of the expected style — a functional component with a typed
// props interface, MUI for presentation, and data access delegated to a
// custom hook rather than inlined:
//
// interface WidgetCardProps { widget: Widget; }
//
// export default function WidgetCard({ widget }: WidgetCardProps) {
//   return (
//     <Card>
//       <CardContent>
//         <Typography variant="h6">{widget.name}</Typography>
//       </CardContent>
//     </Card>
//   );
// }`;

export interface GeneratePromptInput {
  taskDescription: string;
  targetFile: string;
  expectedExports?: string;
  dependencyFileContents: Record<string, string>;
}

export function buildGeneratePrompt(input: GeneratePromptInput): string {
  const depSection = Object.entries(input.dependencyFileContents)
    .map(([path, contents]) => `--- ${path} ---\n${contents}`)
    .join("\n\n");

  return `You are the code-generation stage of an autonomous agent. Write exactly one file.

Task: ${input.taskDescription}
Target file: ${input.targetFile}
${input.expectedExports ? `Expected exports/interface: ${input.expectedExports}\n` : ""}
${STYLE_FEW_SHOT}

${depSection ? `Relevant existing files this task depends on:\n\n${depSection}\n\n` : ""}Return ONLY the complete contents of ${input.targetFile} — no markdown code fences, no
explanation, no surrounding prose. The response body IS the file.`;
}
