import { useEffect, useRef } from 'react'
import Matter from 'matter-js'

export function FallingBlocks() {
  const sceneRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const renderRef = useRef<Matter.Render | null>(null)

  useEffect(() => {
    if (!sceneRef.current) return

    // Module aliases
    const Engine = Matter.Engine
    const Render = Matter.Render
    const World = Matter.World
    const Bodies = Matter.Bodies
    const Body = Matter.Body
    const Runner = Matter.Runner

    // Create engine
    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 }
    })
    engineRef.current = engine

    // Get dimensions
    const width = window.innerWidth
    const height = window.innerHeight

    // Create renderer
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1
      }
    })
    renderRef.current = render

    // Make canvas crisp by setting high DPI
    const canvas = render.canvas
    const context = render.context
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    canvas.width = width * (window.devicePixelRatio || 1)
    canvas.height = height * (window.devicePixelRatio || 1)
    context.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)

    // Create three blocks with text
    const blockWidth = 160
    const blockHeight = 80

    // Random helper function for position variation
    const randomOffset = (base: number, range: number) => base + (Math.random() - 0.5) * range

    // THE block (positioned to fall from left-center area)
    const theBlock = Bodies.rectangle(
      width * 0.4,
      -300,
      blockWidth,
      blockHeight,
      {
        restitution: 0.6,
        friction: 0.3,
        density: 0.001,
        render: {
          fillStyle: '#ef4444', // red
          strokeStyle: 'transparent',
          lineWidth: 0
        },
        label: 'THE'
      }
    )

    // FLIP block (positioned to fall from center)
    const flipBlock = Bodies.rectangle(
      width * 0.55,
      -200,
      blockWidth,
      blockHeight,
      {
        restitution: 0.6,
        friction: 0.3,
        density: 0.001,
        render: {
          fillStyle: '#3b82f6', // blue
          strokeStyle: 'transparent',
          lineWidth: 0
        },
        label: 'FLIP'
      }
    )

    // OFF block (positioned to fall from right-center area)
    const offBlock = Bodies.rectangle(
      width * 0.4,
      -100,
      blockWidth,
      blockHeight,
      {
        restitution: 0.6,
        friction: 0.3,
        density: 0.001,
        render: {
          fillStyle: '#22c55e', // green
          strokeStyle: 'transparent',
          lineWidth: 0
        },
        label: 'OFF'
      }
    )

    // Set blocks to start in horizontal position with no rotation
    Body.setAngle(theBlock, 0)
    Body.setAngle(flipBlock, 0)
    Body.setAngle(offBlock, 0)
    
    Body.setAngularVelocity(theBlock, 0)
    Body.setAngularVelocity(flipBlock, 0)
    Body.setAngularVelocity(offBlock, 0)

    // Create ground (positioned higher, above the GO button)
    const ground = Bodies.rectangle(
      width / 2,
      height - 350,
      width,
      60,
      {
        isStatic: true,
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0
        }
      }
    )

    // Create walls with padding from edges
    const wallPadding = 20 // pixels from edge
    const leftWall = Bodies.rectangle(
      wallPadding,
      height / 2,
      60,
      height,
      {
        isStatic: true,
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0
        }
      }
    )

    const rightWall = Bodies.rectangle(
      width - wallPadding,
      height / 2,
      60,
      height,
      {
        isStatic: true,
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0
        }
      }
    )

    // Create funnel walls (angled inward to guide blocks to center)
    const funnelWidth = 500 // Width of the bucket area at bottom
    const funnelTopY = height / 2 // Start funnel higher up
    const funnelBottomY = height - 350 // Bottom at ground level
    const funnelWallLength = Math.sqrt(Math.pow(funnelBottomY - funnelTopY, 2) + Math.pow(width * 0.4, 2))
    const funnelAngle = Math.atan2(width * 0.2, funnelBottomY - funnelTopY) // Calculate angle based on geometry
    
    const leftFunnel = Bodies.rectangle(
      width / 2 - funnelWidth / 2 - (width * 0.2) / 2,
      (funnelTopY + funnelBottomY) / 2,
      20,
      funnelWallLength,
      {
        isStatic: true,
        angle: -funnelAngle,
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0
        }
      }
    )

    const rightFunnel = Bodies.rectangle(
      width / 2 + funnelWidth / 2 + (width * 0.2) / 2,
      (funnelTopY + funnelBottomY) / 2,
      20,
      funnelWallLength,
      {
        isStatic: true,
        angle: funnelAngle,
        render: {
          fillStyle: 'transparent',
          strokeStyle: 'transparent',
          lineWidth: 0
        }
      }
    )

    // Add all bodies to the world
    World.add(engine.world, [theBlock, flipBlock, offBlock, ground, leftWall, rightWall, leftFunnel, rightFunnel])

    // Run the engine
    const runner = Runner.create()
    Runner.run(runner, engine)

    // Run the renderer
    Render.run(render)

    // Custom rendering for blocks with outset borders and text
    Matter.Events.on(render, 'afterRender', () => {
      const bodies = Matter.Composite.allBodies(engine.world)
      const ctx = render.context
      
      bodies.forEach((body) => {
        if (body.label === 'THE' || body.label === 'FLIP' || body.label === 'OFF') {
          ctx.save()
          ctx.translate(body.position.x, body.position.y)
          ctx.rotate(body.angle)
          
          const halfWidth = blockWidth / 2
          const halfHeight = blockHeight / 2
          
          // Draw outset-style borders
          if (body.label === 'THE') {
            // Light borders (top and left)
            ctx.strokeStyle = '#f87171' // red-400
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(-halfWidth, -halfHeight)
            ctx.lineTo(halfWidth, -halfHeight)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(-halfWidth, -halfHeight)
            ctx.lineTo(-halfWidth, halfHeight)
            ctx.stroke()
            
            // Dark borders (bottom and right)
            ctx.strokeStyle = '#7f1d1d' // red-900
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(-halfWidth, halfHeight)
            ctx.lineTo(halfWidth, halfHeight)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(halfWidth, -halfHeight)
            ctx.lineTo(halfWidth, halfHeight)
            ctx.stroke()
          } else if (body.label === 'FLIP') {
            // Light borders (top and left)
            ctx.strokeStyle = '#60a5fa' // blue-400
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(-halfWidth, -halfHeight)
            ctx.lineTo(halfWidth, -halfHeight)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(-halfWidth, -halfHeight)
            ctx.lineTo(-halfWidth, halfHeight)
            ctx.stroke()
            
            // Dark borders (bottom and right)
            ctx.strokeStyle = '#1e3a8a' // blue-900
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(-halfWidth, halfHeight)
            ctx.lineTo(halfWidth, halfHeight)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(halfWidth, -halfHeight)
            ctx.lineTo(halfWidth, halfHeight)
            ctx.stroke()
          } else if (body.label === 'OFF') {
            // Light borders (top and left)
            ctx.strokeStyle = '#4ade80' // green-400
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(-halfWidth, -halfHeight)
            ctx.lineTo(halfWidth, -halfHeight)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(-halfWidth, -halfHeight)
            ctx.lineTo(-halfWidth, halfHeight)
            ctx.stroke()
            
            // Dark borders (bottom and right)
            ctx.strokeStyle = '#14532d' // green-900
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(-halfWidth, halfHeight)
            ctx.lineTo(halfWidth, halfHeight)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(halfWidth, -halfHeight)
            ctx.lineTo(halfWidth, halfHeight)
            ctx.stroke()
          }
          
          // Enable text antialiasing for crisp text
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          ctx.fillStyle = '#ffffff'
          ctx.font = '400 36px "Alfa Slab One", serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(body.label, 0, 0)
          
          ctx.restore()
        }
      })
    })

    // Cleanup
    return () => {
      Render.stop(render)
      Runner.stop(runner)
      World.clear(engine.world, false)
      Engine.clear(engine)
      if (render.canvas) {
        render.canvas.remove()
      }
    }
  }, [])

  return (
    <div
      ref={sceneRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  )
}
