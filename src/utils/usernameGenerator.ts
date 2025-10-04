// Random username generator inspired by https://xaeman.github.io/usergen/

const adjectives = [
  'swift', 'mighty', 'clever', 'brave', 'wild', 'fierce', 'gentle', 'quick',
  'bold', 'calm', 'eager', 'bright', 'sharp', 'proud', 'cool', 'warm',
  'dark', 'light', 'clear', 'wise', 'strong', 'fast', 'smooth', 'rough',
  'quiet', 'loud', 'soft', 'hard', 'fresh', 'stale', 'hot', 'cold',
  'young', 'ancient', 'tiny', 'giant', 'happy', 'grim', 'lucky', 'odd',
  'rare', 'common', 'noble', 'humble', 'grand', 'simple', 'fancy', 'plain',
  'sleek', 'rugged', 'shiny', 'dull', 'sweet', 'bitter', 'sour', 'spicy',
  'rich', 'poor', 'thick', 'thin', 'heavy', 'light', 'deep', 'shallow'
];

const nouns = [
  'phoenix', 'dragon', 'tiger', 'eagle', 'wolf', 'bear', 'hawk', 'lion',
  'falcon', 'panther', 'cobra', 'shark', 'raven', 'owl', 'fox', 'lynx',
  'viper', 'jaguar', 'rhino', 'bison', 'moose', 'elk', 'deer', 'otter',
  'badger', 'weasel', 'marten', 'stoat', 'skunk', 'raccoon', 'panda', 'koala',
  'sloth', 'lemur', 'gibbon', 'chimp', 'gorilla', 'baboon', 'monkey', 'ape',
  'whale', 'dolphin', 'seal', 'walrus', 'penguin', 'puffin', 'albatross', 'gull',
  'crane', 'heron', 'stork', 'ibis', 'flamingo', 'pelican', 'toucan', 'parrot',
  'macaw', 'cockatoo', 'peacock', 'swan', 'goose', 'duck', 'mallard', 'teal'
];

/**
 * Generates a random username in the format "AdjectiveNoun###"
 * Example: "SwiftPhoenix42", "BraveTiger777"
 */
export function generateRandomUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000); // 0-999
  
  // Capitalize first letter of each word
  const capitalizedAdjective = adjective.charAt(0).toUpperCase() + adjective.slice(1);
  const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1);
  
  return `${capitalizedAdjective}${capitalizedNoun}${number}`;
}
