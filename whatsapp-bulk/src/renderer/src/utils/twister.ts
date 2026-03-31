import { synonymMap } from './synonyms';

/**
 * Parses Spin-Tax format: {word1|word2|word3}
 */
export function applySpinTax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_, match) => {
    const parts = match.split('|');
    // If it's a bracket like {name}, don't process it as spin-tax if it doesn't have a pipe
    if (parts.length === 1) return `{${match}}`; 
    return parts[Math.floor(Math.random() * parts.length)];
  });
}

/**
 * Replaces random words with synonyms from the local dictionary
 * @param text The message to twist
 * @param frequency Chance (0-1) for each eligible word to be replaced
 */
export function twistMessage(text: string, frequency: number = 0.3): string {
  // Don't twist placeholders like {name}
  const parts = text.split(/(\{.*?\})/g);
  
  const twistedParts = parts.map(part => {
    if (part.startsWith('{') && part.endsWith('}')) return part;
    
    return part.split(/\b/).map(word => {
      const lowerWord = word.toLowerCase();
      if (synonymMap[lowerWord] && Math.random() < frequency) {
        const options = synonymMap[lowerWord];
        const replacement = options[Math.floor(Math.random() * options.length)];
        // Preserve capitalization simple logic
        if (word[0] === word[0].toUpperCase()) {
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      }
      return word;
    }).join('');
  });

  return applySpinTax(twistedParts.join(''));
}
