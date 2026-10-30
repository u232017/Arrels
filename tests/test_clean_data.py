from arrels.clean_data import clean_rows, normalize_column_name


def test_normalize_column_name():
    assert normalize_column_name(" Barrio de origen ") == "barrio_de_origen"


def test_clean_rows_normalizes_numbers_and_removes_empty_duplicates():
    rows, columns = clean_rows(
        [
            {"Barrío": " Gràcia ", "Población": "1.234,5"},
            {"Barrío": " Gràcia ", "Población": "1.234,5"},
            {"Barrío": "", "Población": ""},
        ]
    )
    assert columns == ["barrio", "poblacion"]
    assert rows == [{"barrio": "Gràcia", "poblacion": 1234.5}]
