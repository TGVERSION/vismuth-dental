CREATE OR REPLACE FUNCTION search_by_prefix(prefix TEXT, max_results INT DEFAULT 10)
RETURNS TABLE(word TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT d.word
    FROM ml_unigrams d
    WHERE d.word LIKE prefix || '%'
    ORDER BY d.weight DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION predict_by_prefix(prefix TEXT, max_results INT DEFAULT 10)
RETURNS TABLE(bigram_text TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT b.bigram
    FROM ml_bigrams b
    WHERE b.bigram LIKE prefix || '%'
    ORDER BY b.weight DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;