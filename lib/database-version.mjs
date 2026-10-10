// Keep the supported baseline tied to versions covered by integration tests.
export function requireCompatibleVersion(value) {
  if (typeof value !== 'string') throw new Error('Could not identify the MySQL server version.');
  const maria = /MariaDB/i.test(value);
  const normalized = maria ? value.replace(/^5\.5\.5-/, '') : value;
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+ ].*)?$/);
  if (!match) throw new Error(`Could not identify database version ${value}.`);
  const current = match.slice(1, 4).map(Number), minimum = maria ? [10, 6, 0] : [5, 5, 42];
  let supported = true;
  for (let i = 0; i < minimum.length; i++) {
    if (current[i] === minimum[i]) continue;
    supported = current[i] > minimum[i]; break;
  }
  if (!supported) throw new Error(`Your server is ${value}. This version supports MySQL 5.5.42+ or MariaDB 10.6+.`);
  return { family: maria ? 'MariaDB' : 'MySQL', version: current.join('.') };
}
