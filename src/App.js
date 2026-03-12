import { useState, useRef } from "react";

const SYSTEM_PROMPT = `Eres un agente experto en documentación de código PL/SQL. Tu tarea es analizar código PL/SQL y generar documentación clara y completa en formato Markdown optimizado para GitHub Wiki.

REGLAS IMPORTANTES:
1. Escribe en español, de forma simple y amigable, como si explicaras a alguien sin experiencia técnica.
2. Para cada PROCEDURE y FUNCTION genera:
   - Descripción en lenguaje simple (qué hace, para qué sirve en el mundo real)
   - Parámetros: nombre, tipo, si es entrada/salida, y qué representa en términos cotidianos
   - Lo que retorna (si aplica)
   - Un ejemplo de uso con datos ficticios pero realistas (nombres, números, etc.)
   - Posibles errores y qué significan
3. Usa analogías del mundo real para explicar conceptos técnicos.
4. El Markdown debe ser compatible con GitHub Wiki: usa emojis, tablas, badges, bloques de código con sintaxis highlight.
5. Incluye una sección de inicio con resumen general del archivo.
6. Al final incluye un índice navegable.
7. Formato: cada procedure/function debe tener su propio ## heading.

ESTRUCTURA DEL MARKDOWN A GENERAR:
- Encabezado con título y descripción general
- Tabla de contenidos con links
- Para cada objeto: descripción, parámetros en tabla, ejemplo, notas
- Sección de errores comunes
- Pie de página con fecha

IMPORTANTE: Genera SOLO el markdown, sin explicaciones adicionales fuera del mismo.`;

function LoadingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#7c6af7",
            display: "inline-block",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

const EXAMPLE_CODE = `CREATE OR REPLACE PROCEDURE registrar_venta (
  p_cliente_id   IN NUMBER,
  p_producto_id  IN NUMBER,
  p_cantidad     IN NUMBER,
  p_total        OUT NUMBER
) AS
  v_precio NUMBER;
BEGIN
  SELECT precio INTO v_precio FROM productos WHERE id = p_producto_id;
  p_total := v_precio * p_cantidad;
  INSERT INTO ventas (cliente_id, producto_id, cantidad, total, fecha)
  VALUES (p_cliente_id, p_producto_id, p_cantidad, p_total, SYSDATE);
  COMMIT;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20001, 'Producto no encontrado');
END;
/

CREATE OR REPLACE FUNCTION calcular_descuento (
  p_monto     IN NUMBER,
  p_categoria IN VARCHAR2
) RETURN NUMBER AS
  v_descuento NUMBER := 0;
BEGIN
  IF p_categoria = 'VIP' THEN
    v_descuento := p_monto * 0.20;
  ELSIF p_categoria = 'REGULAR' THEN
    v_descuento := p_monto * 0.05;
  END IF;
  RETURN v_descuento;
END;
/`;

export default function App() {
  const [code, setCode] = useState("");
  const [fileName, setFileName] = useState("mi_paquete");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("editor"); // editor | preview | raw
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef();

  const analyze = async () => {
    if (!code.trim()) {
      setError("Por favor ingresa código PL/SQL para analizar.");
      return;
    }
    setError("");
    setLoading(true);
    setMarkdown("");
    setTab("preview");

    try {
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Analiza este código PL/SQL del archivo "${fileName}.sql" y genera la documentación completa en Markdown para GitHub Wiki:\n\n\`\`\`sql\n${code}\n\`\`\``,
            },
          ],
        }),
      });

      const data = await response.json();
      if (data.content && data.content[0]) {
        setMarkdown(data.content[0].text);
      } else {
        setError("No se pudo generar la documentación. Intenta de nuevo.");
      }
    } catch (e) {
      setError("Error al conectar con la API. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMd = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderMarkdown = (md) => {
    if (!md) return "";
    let html = md
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;overflow-x:auto;margin:12px 0"><code style="color:#e6edf3;font-family:'Fira Code',monospace;font-size:13px;line-height:1.6">${escHtml(code.trim())}</code></pre>`
      )
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background:#161b22;color:#f0883e;padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace">$1</code>')
      // H1
      .replace(/^# (.+)$/gm, '<h1 style="font-size:2rem;font-weight:800;color:#7c6af7;margin:32px 0 8px;border-bottom:2px solid #7c6af733;padding-bottom:12px">$1</h1>')
      // H2
      .replace(/^## (.+)$/gm, '<h2 style="font-size:1.4rem;font-weight:700;color:#a78bfa;margin:28px 0 8px;display:flex;align-items:center;gap:8px">$1</h2>')
      // H3
      .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:600;color:#c4b5fd;margin:20px 0 6px">$1</h3>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#f0e6ff;font-weight:700">$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em style="color:#c4b5fd">$1</em>')
      // Tables
      .replace(/(\|.+\|\n)+/g, (table) => {
        const rows = table.trim().split("\n").filter(r => !/^\|[-| ]+\|$/.test(r));
        const isHeader = (i) => i === 0;
        return `<div style="overflow-x:auto;margin:12px 0"><table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map((row, i) => {
          const cells = row.split("|").filter((_, ci) => ci > 0 && ci < row.split("|").length - 1);
          const tag = isHeader(i) ? "th" : "td";
          const style = isHeader(i)
            ? "background:#1e1730;color:#a78bfa;padding:10px 14px;text-align:left;font-weight:600;border:1px solid #30363d"
            : `background:${i % 2 === 0 ? "#0d1117" : "#161b22"};color:#e6edf3;padding:10px 14px;border:1px solid #30363d`;
          return `<tr>${cells.map(c => `<${tag} style="${style}">${c.trim()}</${tag}>`).join("")}</tr>`;
        }).join("")}</table></div>`;
      })
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#7c6af7;text-decoration:none;border-bottom:1px solid #7c6af750">$1</a>')
      // Lists
      .replace(/^- (.+)$/gm, '<li style="color:#c9d1d9;margin:4px 0;padding-left:4px">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, m => `<ul style="margin:8px 0 8px 20px;list-style:disc">${m}</ul>`)
      // Horizontal rule
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #30363d;margin:24px 0">')
      // Badges / emoji first-line paragraph
      .replace(/^(?!<)(.*?)$/gm, (line) => {
        if (!line.trim() || line.startsWith("<")) return line;
        return `<p style="color:#c9d1d9;line-height:1.7;margin:6px 0">${line}</p>`;
      });

    return html;
  };

  const escHtml = (str) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0612 0%, #0d0f1a 50%, #080d1a 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#e6edf3",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #7c6af750; border-radius: 4px; }
        textarea:focus { outline: none; box-shadow: 0 0 0 2px #7c6af750; }
        .btn-primary:hover { background: #6d5ce6 !important; transform: translateY(-1px); }
        .btn-secondary:hover { background: #1e1730 !important; }
        .tab-btn.active { color: #7c6af7 !important; border-bottom: 2px solid #7c6af7 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #0d0f1a, #13102a, #0d0f1a)",
        borderBottom: "1px solid #7c6af730",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c6af7, #a78bfa)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>📚</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px" }}>
              PL/SQL <span style={{ color: "#7c6af7" }}>Doc Agent</span>
            </div>
            <div style={{ fontSize: 11, color: "#8b949e" }}>Generador de Wiki para GitHub</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{
            background: "#7c6af720", border: "1px solid #7c6af740",
            color: "#a78bfa", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
          }}>✨ Powered by Claude AI</span>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

          {/* LEFT PANEL - Editor */}
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 14,
              overflow: "hidden",
            }}>
              {/* Editor Header */}
              <div style={{
                background: "#161b22",
                padding: "12px 16px",
                borderBottom: "1px solid #30363d",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {["#ff5f57","#ffbd2e","#28c840"].map(c => (
                      <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: "#8b949e", fontFamily: "monospace" }}>
                    {fileName}.sql
                  </span>
                </div>
                <button
                  onClick={() => setCode(EXAMPLE_CODE)}
                  style={{
                    background: "transparent", border: "1px solid #30363d",
                    color: "#8b949e", padding: "3px 10px", borderRadius: 6,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}
                  className="btn-secondary"
                >
                  📋 Cargar ejemplo
                </button>
              </div>

              {/* File name input */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #21262d", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#8b949e", whiteSpace: "nowrap" }}>Nombre del archivo:</span>
                <input
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  style={{
                    background: "#0d1117", border: "1px solid #30363d", borderRadius: 6,
                    color: "#e6edf3", padding: "4px 10px", fontSize: 13,
                    fontFamily: "'Fira Code', monospace", flex: 1,
                  }}
                  placeholder="nombre_del_paquete"
                />
                <span style={{ fontSize: 12, color: "#8b949e" }}>.md</span>
              </div>

              {/* Code textarea */}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder={`-- Pega tu código PL/SQL aquí
-- Procedures, Functions, Packages...

CREATE OR REPLACE PROCEDURE mi_procedimiento (
  p_param IN VARCHAR2
) AS
BEGIN
  -- tu lógica aquí
END;
/`}
                style={{
                  width: "100%", minHeight: 380, background: "#0d1117",
                  border: "none", color: "#e6edf3", padding: "16px",
                  fontFamily: "'Fira Code', monospace", fontSize: 13,
                  lineHeight: 1.7, resize: "vertical", boxSizing: "border-box",
                }}
              />

              {/* Error */}
              {error && (
                <div style={{
                  margin: "0 16px 12px", padding: "10px 14px",
                  background: "#ff000015", border: "1px solid #ff000040",
                  borderRadius: 8, color: "#f85149", fontSize: 13,
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Action button */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid #21262d" }}>
                <button
                  onClick={analyze}
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    background: loading ? "#7c6af750" : "linear-gradient(135deg, #7c6af7, #a78bfa)",
                    border: "none", borderRadius: 10, padding: "12px",
                    color: "white", fontWeight: 700, fontSize: 15,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? (
                    <><LoadingDots /> Analizando código...</>
                  ) : (
                    <> 🚀 Generar Documentación Wiki</>
                  )}
                </button>
              </div>
            </div>

            {/* Info cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
              {[
                { icon: "📝", title: "Markdown GitHub", desc: "Compatible con Wiki" },
                { icon: "🌍", title: "Lenguaje simple", desc: "Para no técnicos" },
                { icon: "💡", title: "Ejemplos reales", desc: "Con datos ficticios" },
              ].map(card => (
                <div key={card.title} style={{
                  background: "#0d1117", border: "1px solid #21262d",
                  borderRadius: 10, padding: "12px 14px",
                }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{card.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#e6edf3" }}>{card.title}</div>
                  <div style={{ fontSize: 11, color: "#8b949e" }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL - Output */}
          <div style={{ animation: "fadeIn 0.4s ease 0.1s both" }}>
            <div style={{
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: 14,
              overflow: "hidden",
              minHeight: 520,
            }}>
              {/* Tabs */}
              <div style={{
                background: "#161b22",
                padding: "0 16px",
                borderBottom: "1px solid #30363d",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", gap: 0 }}>
                  {[
                    { key: "preview", label: "👁 Preview" },
                    { key: "raw", label: "📄 Raw MD" },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`tab-btn ${tab === t.key ? "active" : ""}`}
                      style={{
                        background: "transparent", border: "none",
                        borderBottom: tab === t.key ? "2px solid #7c6af7" : "2px solid transparent",
                        color: tab === t.key ? "#7c6af7" : "#8b949e",
                        padding: "12px 14px", cursor: "pointer",
                        fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {markdown && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={copyMarkdown}
                      style={{
                        background: copied ? "#28c84020" : "transparent",
                        border: `1px solid ${copied ? "#28c84050" : "#30363d"}`,
                        color: copied ? "#28c840" : "#8b949e",
                        padding: "4px 10px", borderRadius: 6,
                        fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                        transition: "all 0.2s",
                      }}
                    >
                      {copied ? "✓ Copiado" : "📋 Copiar"}
                    </button>
                    <button
                      onClick={downloadMd}
                      style={{
                        background: "#7c6af720", border: "1px solid #7c6af740",
                        color: "#a78bfa", padding: "4px 10px", borderRadius: 6,
                        fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      ⬇ Descargar .md
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ padding: 20, minHeight: 460, maxHeight: 640, overflowY: "auto" }}>
                {loading && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", height: 400, gap: 16,
                  }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: "50%",
                      background: "linear-gradient(135deg, #7c6af730, #a78bfa30)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28, animation: "pulse 2s infinite",
                    }}>📖</div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ color: "#a78bfa", fontWeight: 600, marginBottom: 6 }}>
                        Analizando tu código PL/SQL...
                      </div>
                      <div style={{ color: "#8b949e", fontSize: 13 }}>
                        Identificando procedures, funciones y generando documentación
                      </div>
                    </div>
                    <LoadingDots />
                  </div>
                )}

                {!loading && !markdown && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", height: 400, gap: 12,
                    color: "#8b949e", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 48 }}>📚</div>
                    <div style={{ fontWeight: 600, color: "#c9d1d9" }}>Tu documentación aparecerá aquí</div>
                    <div style={{ fontSize: 13, maxWidth: 280 }}>
                      Pega tu código PL/SQL en el editor y haz clic en "Generar Documentación"
                    </div>
                  </div>
                )}

                {!loading && markdown && tab === "preview" && (
                  <div
                    style={{ animation: "fadeIn 0.4s ease" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
                  />
                )}

                {!loading && markdown && tab === "raw" && (
                  <pre style={{
                    fontFamily: "'Fira Code', monospace", fontSize: 12,
                    color: "#c9d1d9", lineHeight: 1.7, whiteSpace: "pre-wrap",
                    animation: "fadeIn 0.3s ease",
                  }}>
                    {markdown}
                  </pre>
                )}
              </div>
            </div>

            {/* GitHub instructions */}
            {markdown && (
              <div style={{
                marginTop: 16, background: "#0d1117",
                border: "1px solid #7c6af730", borderRadius: 10, padding: 16,
                animation: "fadeIn 0.5s ease",
              }}>
                <div style={{ fontWeight: 700, marginBottom: 10, color: "#a78bfa", fontSize: 14 }}>
                  📖 Cómo agregar a tu GitHub Wiki
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    `1. Descarga el archivo ${fileName}.md`,
                    "2. Ve a tu repositorio → pestaña Wiki",
                    "3. Haz clic en 'New Page'",
                    "4. Pega el contenido Markdown y guarda",
                    "5. ¡Listo! Tu documentación está en línea 🎉",
                  ].map(step => (
                    <div key={step} style={{ color: "#8b949e", fontSize: 12, display: "flex", gap: 8 }}>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}