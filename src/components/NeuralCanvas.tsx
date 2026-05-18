import { useEffect, useRef } from "react";

interface NeuralCanvasProps {
  variant?: "light" | "dark";
}

export function NeuralCanvas({ variant = "light" }: NeuralCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    let animationId = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      context.clearRect(0, 0, width, height);

      const isDark = variant === "dark";
      context.fillStyle = isDark ? "#07090d" : "#f5f4ef";
      context.fillRect(0, 0, width, height);

      const centerY = height * 0.52;
      const rows = 8;
      const cols = 22;
      const gapX = width / (cols - 1);
      const gapY = Math.min(68, height / 10);

      for (let row = 0; row < rows; row += 1) {
        const points: Array<[number, number]> = [];
        for (let col = 0; col < cols; col += 1) {
          const x = col * gapX;
          const wave =
            Math.sin(col * 0.55 + row * 0.7 + frame * 0.018) * 34 +
            Math.cos(col * 0.22 + frame * 0.011) * 18;
          const y = centerY + (row - rows / 2) * gapY + wave;
          points.push([x, y]);
        }

        context.beginPath();
        points.forEach(([x, y], index) => {
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        context.strokeStyle = isDark
          ? `rgba(255,255,255,${0.08 + row * 0.012})`
          : `rgba(11,19,34,${0.06 + row * 0.014})`;
        context.lineWidth = 1.2;
        context.stroke();
      }

      for (let col = 0; col < cols; col += 2) {
        const x = col * gapX;
        const y =
          centerY +
          Math.sin(col * 0.38 + frame * 0.021) * (height * 0.2);
        context.beginPath();
        context.arc(x, y, 2.2, 0, Math.PI * 2);
        context.fillStyle = isDark ? "#88c8ff" : "#135dff";
        context.globalAlpha = 0.72;
        context.fill();
        context.globalAlpha = 1;
      }

      const ribbonWidth = Math.min(width * 0.54, 760);
      const ribbonX = width * 0.5 - ribbonWidth * 0.5;
      const ribbonY = height * 0.34;
      const gradient = context.createLinearGradient(
        ribbonX,
        ribbonY,
        ribbonX + ribbonWidth,
        ribbonY + height * 0.42,
      );
      gradient.addColorStop(0, isDark ? "rgba(19,93,255,0.18)" : "rgba(19,93,255,0.10)");
      gradient.addColorStop(0.5, isDark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.50)");
      gradient.addColorStop(1, isDark ? "rgba(24,160,88,0.18)" : "rgba(24,160,88,0.11)");
      context.fillStyle = gradient;
      context.beginPath();
      for (let i = 0; i <= 80; i += 1) {
        const t = i / 80;
        const x = ribbonX + ribbonWidth * t;
        const y =
          ribbonY +
          Math.sin(t * Math.PI * 2 + frame * 0.013) * 62 +
          t * height * 0.18;
        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      for (let i = 80; i >= 0; i -= 1) {
        const t = i / 80;
        const x = ribbonX + ribbonWidth * t;
        const y =
          ribbonY +
          160 +
          Math.sin(t * Math.PI * 2 + frame * 0.013) * 62 +
          t * height * 0.18;
        context.lineTo(x, y);
      }
      context.closePath();
      context.fill();

      frame += 1;
      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, [variant]);

  return <canvas className="neural-canvas" ref={canvasRef} aria-hidden="true" />;
}
