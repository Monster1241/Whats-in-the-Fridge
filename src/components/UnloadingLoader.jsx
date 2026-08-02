const GROCERY_ITEMS = [
  { id: 'milk', emoji: '🥛', delay: '0s' },
  { id: 'bread', emoji: '🍞', delay: '0.55s' },
  { id: 'eggs', emoji: '🥚', delay: '1.1s' },
];

/**
 * Looping animation: groceries move from shopping cart onto the pantry shelf.
 * @param {{ size?: 'sm' | 'md', className?: string }} props
 */
export function UnloadingLoader({ size = 'md', className = '' }) {
  return (
    <div
      className={`unload-loader unload-loader--${size}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label="Unloading groceries from cart to pantry shelf"
    >
      <div className="unload-loader__scene">
        <div className="unload-loader__cart" aria-hidden>
          <div className="unload-loader__cart-body">
            <div className="unload-loader__cart-rim" />
            <div className="unload-loader__cart-basket" />
            <div className="unload-loader__cart-wheel unload-loader__cart-wheel--left" />
            <div className="unload-loader__cart-wheel unload-loader__cart-wheel--right" />
            <div className="unload-loader__cart-handle" />
          </div>
          <span className="unload-loader__cart-label">Shopping</span>
        </div>

        <div className="unload-loader__path" aria-hidden>
          {GROCERY_ITEMS.map((item) => (
            <span
              key={item.id}
              className={`unload-loader__item unload-loader__item--${item.id}`}
              style={{ animationDelay: item.delay }}
            >
              {item.emoji}
            </span>
          ))}
        </div>

        <div className="unload-loader__shelf" aria-hidden>
          <div className="unload-loader__shelf-bracket unload-loader__shelf-bracket--left" />
          <div className="unload-loader__shelf-board">
            <span className="unload-loader__shelf-slot unload-loader__shelf-slot--1">🥛</span>
            <span className="unload-loader__shelf-slot unload-loader__shelf-slot--2">🍞</span>
            <span className="unload-loader__shelf-slot unload-loader__shelf-slot--3">🥚</span>
          </div>
          <div className="unload-loader__shelf-bracket unload-loader__shelf-bracket--right" />
          <span className="unload-loader__shelf-label">Pantry</span>
        </div>
      </div>
    </div>
  );
}
