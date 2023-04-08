def max_line_length(content):
    return max([0] + [len(x) for x in content.splitlines()])


def avg_line_length(content):
    lines = [len(x) for x in content.splitlines()]
    total = sum(lines)
    return total / len(lines) if lines else 0


def alphanum_fraction(content):
    alphanum = [x for x in content if x.isalpha() or x.isnumeric()]
    return len(alphanum) / len(content) if len(content) != 0 else 0


def compute(content):
    return dict(
        max_line_length=max_line_length(content),
        avg_line_length=avg_line_length(content),
        alphanum_fraction=alphanum_fraction(content),
    )
