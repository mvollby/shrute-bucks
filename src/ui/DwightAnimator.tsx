import { useEffect, useState } from 'react'
import { DWIGHT_QUOTES } from './dwightQuotes'

const DEFAULT_CHARACTER = 'a-00.png'

// Every character except the default -- picked from the two 22-character
// sheets the user provided, background-removed and cropped to content
// (see scripts/process_character_sheet.py).
const OTHER_CHARACTERS = [
  'a-01.png',
  'a-02.png',
  'a-10.png',
  'a-11.png',
  'a-12.png',
  'a-20.png',
  'a-21.png',
  'a-22.png',
  'a-30.png',
  'b-00.png',
  'b-01.png',
  'b-02.png',
  'b-10.png',
  'b-11.png',
  'b-12.png',
  'b-20.png',
  'b-21.png',
  'b-22.png',
  'b-30.png',
  'b-31.png',
  'b-32.png',
]

const SWAP_INTERVAL_MS = 15000

function randomQuote(): string {
  return DWIGHT_QUOTES[Math.floor(Math.random() * DWIGHT_QUOTES.length)]
}

// The header mascot: rests on "default Dwight," swaps to a random one of
// the other 21 characters and back, roughly every 15 seconds, forever --
// and the speech bubble picks a new random quote on that same beat, so
// the two always change together. Purely decorative -- no persisted
// state, no click handling.
export function DwightAnimator() {
  const [character, setCharacter] = useState(DEFAULT_CHARACTER)
  const [quote, setQuote] = useState(randomQuote)

  // Preload every character up front. Without this, the quote (plain
  // text, swaps instantly) and the character image (has to finish a
  // network fetch the first time it's shown) update in the same React
  // batch but don't visibly land at the same moment -- the old image
  // keeps showing until the new one finishes loading. Caching all 22
  // ahead of time means every later swap is instant from cache.
  useEffect(() => {
    for (const name of [DEFAULT_CHARACTER, ...OTHER_CHARACTERS]) {
      const img = new Image()
      img.src = `/characters/${name}`
    }
  }, [])

  useEffect(() => {
    let onDefault = true
    const id = setInterval(() => {
      onDefault = !onDefault
      setCharacter(onDefault ? DEFAULT_CHARACTER : OTHER_CHARACTERS[Math.floor(Math.random() * OTHER_CHARACTERS.length)])
      setQuote(randomQuote())
    }, SWAP_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div id="dwight-scene">
      <div id="speech-bubble">{quote}</div>
      <img src={`/characters/${character}`} alt="Dwight Schrute" id="dwight-mascot" />
    </div>
  )
}
