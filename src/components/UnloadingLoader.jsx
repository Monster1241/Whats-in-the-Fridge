const GROCERY_ITEMS = [
  { id: 'milk', emoji: '🥛', slot: 1 },
  { id: 'bread', emoji: '🍞', slot: 2 },
  { id: 'eggs', emoji: '🥚', slot: 3 },
];

/**
 * Looping animation: groceries move from shopping cart into the pantry cabinet.
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
            {GROCERY_ITEMS.map((item) => (
              <span
                key={`cart-${item.id}`}
                className={`unload-loader__cart-stock unload-loader__cart-stock--${item.slot}`}
              >
                {item.emoji}
              </span>
            ))}
          </div>
          <span className="unload-loader__cart-label">Shopping</span>
        </div>

        <div className="unload-loader__path" aria-hidden>
          {GROCERY_ITEMS.map((item) => (
            <span
              key={item.id}
              className={`unload-loader__item unload-loader__item--${item.slot}`}
            >
              {item.emoji}
            </span>
          ))}
        </div>

        <div className="unload-loader__pantry" aria-hidden>
          <div className="unload-loader__pantry-unit">
            <div className="unload-loader__pantry-interior">
              <div className="unload-loader__pantry-back" />
              <div className="unload-loader__pantry-shine" />

              <div className="unload-loader__pantry-tier unload-loader__pantry-tier--top">
                <div className="unload-loader__pantry-plank">
                  <span className="unload-loader__pantry-plank-edge" />
                </div>
              </div>

              <div className="unload-loader__pantry-tier unload-loader__pantry-tier--main">
                <div className="unload-loader__pantry-plank unload-loader__pantry-plank--active">
                  <span className="unload-loader__pantry-plank-edge" />
                </div>
                <div className="unload-loader__pantry-slots">
                  {GROCERY_ITEMS.map((item) => (
                    <div key={item.id} className="unload-loader__pantry-slot">
                      <span className={`unload-loader__pantry-pad unload-loader__pantry-pad--${item.slot}`} />
                      <span className={`unload-loader__shelf-slot unload-loader__shelf-slot--${item.slot}`}>
                        {item.emoji}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <span className="unload-loader__pantry-bracket unload-loader__pantry-bracket--left" />
              <span className="unload-loader__pantry-bracket unload-loader__pantry-bracket--right" />
            </div>

            <div className="unload-loader__pantry-door unload-loader__pantry-door--left">
              <span className="unload-loader__pantry-knob" />
            </div>
            <div className="unload-loader__pantry-door unload-loader__pantry-door--right">
              <span className="unload-loader__pantry-knob" />
            </div>
          </div>

          <div className="unload-loader__pantry-status">
            {GROCERY_ITEMS.map((item) => (
              <span
                key={`dot-${item.id}`}
                className={`unload-loader__pantry-dot unload-loader__pantry-dot--${item.slot}`}
              />
            ))}
          </div>

          <span className="unload-loader__shelf-label">Pantry</span>
        </div>
      </div>
    </div>
  );
}
